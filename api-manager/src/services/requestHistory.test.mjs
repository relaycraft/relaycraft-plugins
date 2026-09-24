// Run: node --experimental-strip-types --test src/services/requestHistory.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RequestHistoryService,
  REQUEST_HISTORY_V2_PREFIX,
  REQUEST_HISTORY_V2_LIMIT,
} from "./requestHistory.ts";

function createKv(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    get: async (key) => (data.has(key) ? data.get(key) : null),
    set: async (key, value) => void data.set(key, String(value)),
    list: async (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    delete: async (key) => void data.delete(key),
  };
}

const BIG_BODY = "x".repeat(100 * 1024);

describe("RequestHistoryService", () => {
  it("writes only tiny metadata records even for 100KiB raw responses", async () => {
    const kv = createKv();
    const svc = new RequestHistoryService(kv);
    for (let i = 0; i < 11; i++) {
      await svc.append({
        id: `v${i}`,
        sourceRequestId: "req1",
        createdAt: 1000 + i,
        result: {
          status: 200,
          time: 10 + i,
          totalBytes: 100 * 1024,
          // Simulate a caller that hands us the raw response — it must be dropped.
          body: BIG_BODY,
          headers: { authorization: "Bearer secret" },
        },
      });
    }
    const keys = [...kv.data.keys()].filter((k) => k.startsWith(REQUEST_HISTORY_V2_PREFIX));
    assert.equal(keys.length, 11);
    for (const key of keys) {
      const raw = kv.data.get(key);
      assert.ok(raw.length < 300, `${key} stored ${raw.length} bytes`);
      const parsed = JSON.parse(raw);
      assert.deepEqual(Object.keys(parsed).sort(), ["createdAt", "id", "result", "sourceRequestId"]);
      assert.deepEqual(Object.keys(parsed.result).sort(), ["status", "time", "totalBytes"]);
      assert.equal(raw.includes("secret"), false);
      assert.equal(raw.includes(BIG_BODY), false);
    }
  });

  it("leaves the legacy key byte-identical on append", async () => {
    const legacyRaw = JSON.stringify([
      { id: "l1", sourceRequestId: "req1", createdAt: 5, snapshot: { body: "keep" }, result: { status: 200, time: 1, totalBytes: 9, body: "old" } },
    ]);
    const kv = createKv({ request_history: legacyRaw });
    const svc = new RequestHistoryService(kv);
    await svc.append({ id: "v1", sourceRequestId: "req1", createdAt: 100, result: { status: 201, time: 2, totalBytes: 3 } });
    assert.equal(kv.data.get("request_history"), legacyRaw);
  });

  it("merges V2 + legacy newest-first and dedups by id", async () => {
    const legacyRaw = JSON.stringify([
      { id: "l-old", sourceRequestId: "req1", createdAt: 10, snapshot: {}, result: { status: 200 } },
      { id: "dup", sourceRequestId: "req1", createdAt: 30, result: { status: 500 } },
    ]);
    const kv = createKv({ request_history: legacyRaw });
    const svc = new RequestHistoryService(kv);
    await svc.append({ id: "v-mid", sourceRequestId: "req1", createdAt: 20, result: { status: 200, time: 1, totalBytes: 1 } });
    await svc.append({ id: "v-new", sourceRequestId: "req1", createdAt: 40, result: { status: 204, time: 1, totalBytes: 1 } });
    await svc.append({ id: "dup", sourceRequestId: "req1", createdAt: 30, result: { status: 200, time: 1, totalBytes: 1 } });

    const merged = await svc.getMerged();
    assert.deepEqual(merged.map((x) => x.id), ["v-new", "dup", "v-mid", "l-old"]);
    // Legacy item keeps its snapshot fields intact.
    assert.deepEqual(merged[3].snapshot, {});
    // The deduped "dup" is the V2 record (first occurrence after sort).
    assert.equal(merged[1].result.totalBytes, 1);
  });

  it("retains at most 30 V2 entries, deleting only V2 keys", async () => {
    const legacyRaw = JSON.stringify(
      Array.from({ length: 35 }, (_, i) => ({ id: `l${i}`, sourceRequestId: "r", createdAt: i, result: { status: 200 } })),
    );
    const kv = createKv({ request_history: legacyRaw });
    const svc = new RequestHistoryService(kv);
    for (let i = 0; i < 35; i++) {
      await svc.append({ id: `v${String(i).padStart(2, "0")}`, sourceRequestId: "r", createdAt: i, result: { status: 200, time: 1, totalBytes: 1 } });
    }
    const v2 = await svc.listV2();
    assert.equal(v2.length, REQUEST_HISTORY_V2_LIMIT);
    // Oldest V2 (createdAt 0..4) trimmed; newest kept.
    const ids = v2.map((x) => x.id).sort();
    assert.equal(ids.includes("v00"), false);
    assert.equal(ids.includes("v04"), false);
    assert.equal(ids.includes("v05"), true);
    assert.equal(ids.includes("v34"), true);
    // Legacy untouched by retention.
    assert.equal(kv.data.get("request_history"), legacyRaw);
    // Merged still contains all 35 legacy entries.
    const merged = await svc.getMerged();
    assert.equal(merged.filter((x) => x.id.startsWith("l")).length, 35);
  });

  it("explicit delete/clear operations span both stores", async () => {
    const legacyRaw = JSON.stringify([
      { id: "l1", sourceRequestId: "req1", createdAt: 1, result: { status: 200 } },
      { id: "l2", sourceRequestId: "req2", createdAt: 2, result: { status: 200 } },
    ]);
    const kv = createKv({ request_history: legacyRaw });
    const svc = new RequestHistoryService(kv);
    await svc.append({ id: "v1", sourceRequestId: "req1", createdAt: 10, result: { status: 200, time: 1, totalBytes: 1 } });
    await svc.append({ id: "v2", sourceRequestId: "req2", createdAt: 20, result: { status: 200, time: 1, totalBytes: 1 } });

    // deleteById removes from both stores.
    await svc.deleteById("l1");
    await svc.deleteById("v1");
    let merged = await svc.getMerged();
    assert.deepEqual(merged.map((x) => x.id).sort(), ["l2", "v2"]);

    // clearBySource removes matching entries in both stores.
    await svc.append({ id: "v3", sourceRequestId: "req2", createdAt: 30, result: { status: 200, time: 1, totalBytes: 1 } });
    await svc.clearBySource("req2");
    merged = await svc.getMerged();
    assert.deepEqual(merged, []);

    // clearAll removes everything from both stores.
    await svc.append({ id: "v9", sourceRequestId: "req9", createdAt: 90, result: { status: 200, time: 1, totalBytes: 1 } });
    kv.data.set("request_history", JSON.stringify([{ id: "l9", sourceRequestId: "req9", createdAt: 9 }]));
    await svc.clearAll();
    assert.deepEqual(await svc.getMerged(), []);
    const remainingV2 = [...kv.data.keys()].filter((k) => k.startsWith(REQUEST_HISTORY_V2_PREFIX));
    assert.equal(remainingV2.length, 0);
  });

  it("sanitizes malformed numeric fields to 0", async () => {
    const kv = createKv();
    const svc = new RequestHistoryService(kv);
    await svc.append({
      id: "bad",
      sourceRequestId: "req1",
      createdAt: "not-a-number",
      result: { status: "abc", time: Number.NaN, totalBytes: undefined },
    });
    const [item] = await svc.listV2();
    assert.equal(item.createdAt, 0);
    assert.deepEqual(item.result, { status: 0, time: 0, totalBytes: 0 });
  });

  it("rejects unsafe or overlong ids without writing anything", async () => {
    const kv = createKv();
    const svc = new RequestHistoryService(kv);
    const base = { sourceRequestId: "r", createdAt: 1, result: { status: 1, time: 1, totalBytes: 1 } };
    await assert.rejects(svc.append({ ...base, id: "weird id/slash" }));
    await assert.rejects(svc.append({ ...base, id: "" }));
    await assert.rejects(svc.append({ ...base, id: "a".repeat(200) }));
    // Two distinct ids must never alias onto one record.
    await assert.rejects(svc.append({ ...base, id: "a/b" }));
    assert.equal(kv.data.size, 0);
  });

  it("whitelist-reads V2 records and never leaks extra persisted fields", async () => {
    const kv = createKv();
    // Inject a foreign field into a well-formed V2 record, plus a fully
    // malformed record.
    kv.data.set(
      `${REQUEST_HISTORY_V2_PREFIX}v1`,
      JSON.stringify({
        id: "v1",
        sourceRequestId: "req1",
        createdAt: 10,
        result: { status: 200, time: 3, totalBytes: 4 },
        secret: "Bearer leaked-token",
        snapshot: { body: "should-not-leak" },
      }),
    );
    kv.data.set(`${REQUEST_HISTORY_V2_PREFIX}v2`, JSON.stringify({ id: "v2", junk: true }));
    kv.data.set(`${REQUEST_HISTORY_V2_PREFIX}v3`, "{broken json");

    const svc = new RequestHistoryService(kv);
    const merged = await svc.getMerged();
    assert.equal(merged.length, 1);
    const item = merged[0];
    assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id", "result", "sourceRequestId"]);
    assert.equal(JSON.stringify(item).includes("leaked-token"), false);
    assert.equal("secret" in item, false);
    assert.equal("snapshot" in item, false);
  });

  it("removes a malformed legacy key on explicit clear but preserves it on append", async () => {
    const kv = createKv({ request_history: "{not-valid-json" });
    const svc = new RequestHistoryService(kv);
    // Append must not touch the malformed legacy key.
    await svc.append({ id: "v1", sourceRequestId: "r", createdAt: 1, result: { status: 200, time: 1, totalBytes: 1 } });
    assert.equal(kv.data.get("request_history"), "{not-valid-json");
    // Explicit clear removes it entirely.
    await svc.clearAll();
    assert.equal(kv.data.has("request_history"), false);
  });
});
