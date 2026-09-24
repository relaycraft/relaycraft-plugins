// Run: node --experimental-strip-types --test src/actionHub.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createActionHub } from "./actionHub.ts";

const REQUEST = {
  id: "req1",
  name: "demo",
  method: "GET",
  url: "https://example.test/api",
  headers: [],
  params: [],
  body: null,
};

function makeHub({ send, appendImpl }) {
  const calls = { append: 0 };
  const responses = [];
  const toasts = [];
  const histories = [];
  const storage = {
    appendRequestHistory: async (entry) => {
      calls.append += 1;
      const next = await appendImpl(entry);
      histories.push(next);
      return next;
    },
  };
  const api = {
    http: { send },
    ui: { toast: (message, type) => toasts.push({ message, type }) },
    log: { error: () => {} },
  };
  const hub = createActionHub({
    storage,
    api,
    t: (key) => key,
    parseOpenApi: () => [],
    generateId: () => `gen-${calls.append}`,
    runnerAbortRef: { current: false },
    getState: () => ({ activeRequest: REQUEST, activeVariables: {} }),
    setState: {
      setSending: () => {},
      setResponse: (r) => responses.push(r),
      setRequestHistory: (h) => histories.push(h),
    },
  });
  return { hub, calls, responses, toasts, histories };
}

describe("sendRequest history append", () => {
  it("failed history write keeps the real response and appends exactly once", async () => {
    const { hub, calls, responses, toasts } = makeHub({
      send: async () => ({ status: 200, body: "{}", headers: {}, total_bytes: 12 }),
      appendImpl: async () => {
        throw new Error("kv quota exceeded");
      },
    });
    await hub.sendRequest();

    assert.equal(calls.append, 1, "history append must run exactly once");
    assert.equal(responses.length, 1);
    assert.equal(responses[0].status, 200, "real response must be preserved");
    assert.equal(responses[0].total_bytes, 12);
    assert.ok(
      toasts.some((x) => x.message === "history_save_failed" && x.type === "warning"),
      `expected history_save_failed warning, got ${JSON.stringify(toasts)}`,
    );
    // No error-shaped response (status 0) was ever set.
    assert.equal(responses.some((r) => r.status === 0), false);
  });

  it("network failure still appends history exactly once", async () => {
    const { hub, calls, responses } = makeHub({
      send: async () => {
        throw new Error("connection refused");
      },
      appendImpl: async () => [{ id: "h1" }],
    });
    await hub.sendRequest();

    assert.equal(calls.append, 1);
    assert.equal(responses.length, 1);
    assert.equal(responses[0].status, 0);
    assert.equal(responses[0].body, "connection refused");
  });

  it("append failure on the error path is swallowed the same way", async () => {
    const { hub, calls, responses, toasts } = makeHub({
      send: async () => {
        throw new Error("timeout");
      },
      appendImpl: async () => {
        throw new Error("kv quota exceeded");
      },
    });
    await hub.sendRequest();

    assert.equal(calls.append, 1);
    assert.equal(responses[0].status, 0);
    assert.ok(toasts.some((x) => x.message === "history_save_failed"));
  });
});
