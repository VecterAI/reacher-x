import { describe, expect, it } from "vitest";
import {
  createLinkedInVoiceNoteFile,
  inspectLinkedInM4aContainer,
  normalizeLinkedInM4aContainer,
} from "../../../shared/lib/utils/media/linkedinVoiceNote";

function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(
    new ArrayBuffer(parts.reduce((total, part) => total + part.byteLength, 0))
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function box(type: string, ...payload: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = concatBytes(...payload);
  return concatBytes(
    uint32(body.byteLength + 8),
    new TextEncoder().encode(type),
    body
  );
}

function makeMediaRecorderMp4(durationMs = 5_000): Uint8Array<ArrayBuffer> {
  const ftyp = Uint8Array.from([
    0x00, 0x00, 0x00, 0x24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x36,
    0x69, 0x73, 0x6f, 0x32, 0x76, 0x70, 0x30, 0x39, 0x6d, 0x70, 0x34, 0x31,
  ]);
  const timescale = 48_000;
  const duration = Math.round((durationMs / 1000) * timescale);
  const mdhd = box(
    "mdhd",
    Uint8Array.from([0, 0, 0, 0]),
    uint32(0),
    uint32(0),
    uint32(timescale),
    uint32(duration),
    Uint8Array.from([0, 0, 0, 0])
  );
  const hdlr = box(
    "hdlr",
    Uint8Array.from([0, 0, 0, 0]),
    uint32(0),
    new TextEncoder().encode("soun"),
    Uint8Array.from({ length: 12 }, () => 0)
  );
  const moov = box("moov", box("trak", box("mdia", mdhd, hdlr), box("mp4a")));
  return concatBytes(ftyp, moov, box("mdat"));
}

describe("LinkedIn M4A voice-note normalization", () => {
  it("brands MediaRecorder MP4 as M4A without shifting or changing audio data", () => {
    const source = makeMediaRecorderMp4();
    const normalized = normalizeLinkedInM4aContainer(source);

    expect(normalized).not.toBe(source);
    expect(normalized.byteLength).toBe(source.byteLength);
    expect(new TextDecoder().decode(normalized.slice(8, 12))).toBe("M4A ");
    expect(new TextDecoder().decode(normalized.slice(16, 28))).toBe(
      "M4A mp42isom"
    );
    expect(normalized.slice(36)).toEqual(source.slice(36));
  });

  it("creates a provider-safe native LinkedIn M4A file", async () => {
    const file = await createLinkedInVoiceNoteFile(
      new Blob([makeMediaRecorderMp4()], {
        type: "audio/mp4;codecs=mp4a.40.2",
      }),
      "voice-note.m4a"
    );

    expect(file.name).toBe("voice-note.m4a");
    expect(file.type).toBe("audio/x-m4a");
    expect(
      new TextDecoder().decode((await file.arrayBuffer()).slice(8, 12))
    ).toBe("M4A ");
  });

  it("derives duration from the real audio track and enforces one minute", () => {
    expect(inspectLinkedInM4aContainer(makeMediaRecorderMp4(59_750))).toEqual({
      durationMs: 59_750,
    });
    expect(() =>
      inspectLinkedInM4aContainer(makeMediaRecorderMp4(60_001))
    ).toThrow("up to 1 minute");
  });

  it("rejects a non-MP4 recording", () => {
    expect(() =>
      normalizeLinkedInM4aContainer(Uint8Array.from([1, 2, 3]))
    ).toThrow("not a valid MP4 audio file");
  });

  it("rejects a truncated extended-size MP4 box", () => {
    const truncated = concatBytes(
      uint32(1),
      new TextEncoder().encode("ftyp"),
      uint32(0)
    );

    expect(() => inspectLinkedInM4aContainer(truncated)).toThrow(
      "truncated MP4 box"
    );
  });
});
