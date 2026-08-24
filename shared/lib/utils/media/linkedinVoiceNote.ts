import { LINKEDIN_NATIVE_VOICE_MESSAGE_MIME_TYPE } from "./linkedinMessageAttachmentTypes";

const MP4_BOX_TYPE_OFFSET = 4;
const MP4_MAJOR_BRAND_OFFSET = 8;
const MP4_MINOR_VERSION_OFFSET = 12;
const MP4_COMPATIBLE_BRANDS_OFFSET = 16;
const MINIMUM_FTYP_BOX_SIZE = 28;

const FTYP_BOX = [0x66, 0x74, 0x79, 0x70] as const;
const M4A_BRAND = [0x4d, 0x34, 0x41, 0x20] as const;
const LINKEDIN_COMPATIBLE_BRANDS = [
  ...M4A_BRAND,
  0x6d,
  0x70,
  0x34,
  0x32,
  0x69,
  0x73,
  0x6f,
  0x6d,
] as const;
const MAXIMUM_LINKEDIN_VOICE_NOTE_DURATION_MS = 60_000;

type Mp4Box = { type: string; start: number; dataStart: number; end: number };

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(offset, false);
}

function bytesMatch(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[]
): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function readUint64(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value = view.getBigUint64(offset, false);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Voice note duration is invalid.");
  }
  return Number(value);
}

function readBox(bytes: Uint8Array, offset: number, limit: number): Mp4Box {
  if (offset + 8 > limit) {
    throw new Error("Voice note recording has a truncated MP4 box.");
  }
  const size32 = readUint32(bytes, offset);
  const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
  const headerSize = size32 === 1 ? 16 : 8;
  if (offset + headerSize > limit) {
    throw new Error("Voice note recording has a truncated MP4 box.");
  }
  const size =
    size32 === 0
      ? limit - offset
      : size32 === 1
        ? readUint64(bytes, offset + 8)
        : size32;
  if (size < headerSize || offset + size > limit) {
    throw new Error("Voice note recording has an invalid MP4 box size.");
  }
  return {
    type,
    start: offset,
    dataStart: offset + headerSize,
    end: offset + size,
  };
}

function listBoxes(
  bytes: Uint8Array,
  start = 0,
  end = bytes.byteLength
): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset < end) {
    const box = readBox(bytes, offset, end);
    boxes.push(box);
    offset = box.end;
  }
  return boxes;
}

function getChildBox(
  bytes: Uint8Array,
  parent: Mp4Box,
  type: string
): Mp4Box | undefined {
  return listBoxes(bytes, parent.dataStart, parent.end).find(
    (box) => box.type === type
  );
}

function hasAscii(bytes: Uint8Array, value: string): boolean {
  const expected = [...value].map((character) => character.charCodeAt(0));
  for (let offset = 0; offset <= bytes.byteLength - expected.length; offset++) {
    if (bytesMatch(bytes, offset, expected)) return true;
  }
  return false;
}

/** Validate real M4A/AAC bytes and derive duration from the audio track. */
export function inspectLinkedInM4aContainer(source: Uint8Array): {
  durationMs: number;
} {
  const topLevel = listBoxes(source);
  const ftyp = topLevel.find((box) => box.type === "ftyp");
  const moov = topLevel.find((box) => box.type === "moov");
  if (!ftyp || !moov || !hasAscii(source, "mp4a")) {
    throw new Error("Voice note must contain M4A AAC audio.");
  }

  const tracks = listBoxes(source, moov.dataStart, moov.end).filter(
    (box) => box.type === "trak"
  );
  for (const track of tracks) {
    const mdia = getChildBox(source, track, "mdia");
    if (!mdia) continue;
    const hdlr = getChildBox(source, mdia, "hdlr");
    const mdhd = getChildBox(source, mdia, "mdhd");
    if (!hdlr || !mdhd || mdhd.dataStart + 12 > mdhd.end) continue;
    const handlerOffset = hdlr.dataStart + 8;
    if (
      handlerOffset + 4 > hdlr.end ||
      !bytesMatch(source, handlerOffset, [0x73, 0x6f, 0x75, 0x6e])
    ) {
      continue;
    }

    const version = source[mdhd.dataStart];
    const timescaleOffset = mdhd.dataStart + (version === 1 ? 20 : 12);
    const durationOffset = timescaleOffset + 4;
    if (durationOffset + (version === 1 ? 8 : 4) > mdhd.end) {
      throw new Error("Voice note audio duration is missing.");
    }
    const timescale = readUint32(source, timescaleOffset);
    const duration =
      version === 1
        ? readUint64(source, durationOffset)
        : readUint32(source, durationOffset);
    if (timescale <= 0 || duration <= 0) {
      throw new Error("Voice note audio duration is invalid.");
    }
    const durationMs = Math.round((duration / timescale) * 1000);
    if (durationMs > MAXIMUM_LINKEDIN_VOICE_NOTE_DURATION_MS) {
      throw new Error("LinkedIn voice notes can be up to 1 minute.");
    }
    return { durationMs };
  }
  throw new Error("Voice note does not contain a valid audio track.");
}

/**
 * MediaRecorder emits valid AAC inside a generic ISO MP4 container. LinkedIn's
 * native voice endpoint requires the same audio to be branded as M4A. Rewriting
 * the fixed-size ftyp metadata leaves every encoded audio byte and offset intact.
 */
export function normalizeLinkedInM4aContainer(
  source: Uint8Array
): Uint8Array<ArrayBuffer> {
  if (
    source.byteLength < MINIMUM_FTYP_BOX_SIZE ||
    !bytesMatch(source, MP4_BOX_TYPE_OFFSET, FTYP_BOX)
  ) {
    throw new Error("Voice note recording is not a valid MP4 audio file.");
  }

  const ftypBoxSize = readUint32(source, 0);
  if (ftypBoxSize < MINIMUM_FTYP_BOX_SIZE || ftypBoxSize > source.byteLength) {
    throw new Error("Voice note recording has an invalid MP4 header.");
  }

  inspectLinkedInM4aContainer(source);

  const normalized = new Uint8Array(new ArrayBuffer(source.byteLength));
  normalized.set(source);
  normalized.set(M4A_BRAND, MP4_MAJOR_BRAND_OFFSET);
  normalized.fill(0, MP4_MINOR_VERSION_OFFSET, MP4_COMPATIBLE_BRANDS_OFFSET);
  normalized.set(LINKEDIN_COMPATIBLE_BRANDS, MP4_COMPATIBLE_BRANDS_OFFSET);
  return normalized;
}

export async function createLinkedInVoiceNoteFile(
  recording: Blob,
  fileName: string
): Promise<File> {
  const normalized = normalizeLinkedInM4aContainer(
    new Uint8Array(await recording.arrayBuffer())
  );
  return new File([normalized], fileName, {
    type: LINKEDIN_NATIVE_VOICE_MESSAGE_MIME_TYPE,
  });
}
