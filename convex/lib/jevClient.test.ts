import { afterEach, describe, expect, test, vi } from "vitest";
import { callJevDecisions, JevClientError } from "./jevClient";

const previousApiKey = process.env.OPENROUTER_API_KEY;

const validPayload = {
  id: "resp-1",
  model: "typesafe/jev-1.13",
  provider: "typesafe",
  answers: {
    q1: { type: "choice", choice: "matched", confidence: 0.9 },
  },
  usage: { cost: 0.01, input_tokens: 100, output_tokens: 10 },
};

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (previousApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = previousApiKey;
  }
});

describe("callJevDecisions transport retries", () => {
  test("retries when a 2xx body read fails mid-stream", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new TypeError("terminated");
        },
      })
      .mockResolvedValueOnce(jsonResponse(validPayload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callJevDecisions({
      state: {},
      questions: { q1: { type: "choice", instructions: "x", criteria: {} } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.response.answers.q1).toMatchObject({ choice: "matched" });
  });

  test("does not retry a 2xx response with a malformed JSON body", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callJevDecisions({
        state: {},
        questions: { q1: { type: "choice", instructions: "x", criteria: {} } },
      })
    ).rejects.toThrow(JevClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
