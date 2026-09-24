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

function makeHub({ send, appendImpl, rules, getState, failSaveCollection }) {
  const calls = { append: 0, createMock: [], saveCollection: 0 };
  const responses = [];
  const toasts = [];
  const histories = [];
  const mockDrafts = [];
  const mockOpens = [];
  const logErrors = [];
  const storage = {
    appendRequestHistory: async (entry) => {
      calls.append += 1;
      const next = await appendImpl(entry);
      histories.push(next);
      return next;
    },
    saveCollection: async () => {
      calls.saveCollection += 1;
      const fail = typeof failSaveCollection === "function" ? failSaveCollection() : failSaveCollection;
      if (fail) throw new Error("kv quota exceeded");
    },
    loadIndex: async () => [],
    getCollection: async () => null,
  };
  const api = {
    http: { send },
    rules: rules ?? {},
    ui: { toast: (message, type) => toasts.push({ message, type }) },
    log: { error: (...args) => logErrors.push(args) },
  };
  if (api.rules.createMock) {
    const inner = api.rules.createMock;
    api.rules.createMock = async (args) => {
      calls.createMock.push(args);
      return inner(args);
    };
  }
  const hub = createActionHub({
    storage,
    api,
    t: (key) => key,
    parseOpenApi: () => [],
    generateId: () => `gen-${calls.append}`,
    runnerAbortRef: { current: false },
    getState: getState ?? (() => ({ activeRequest: REQUEST, activeVariables: {} })),
    setState: {
      setSending: () => {},
      setResponse: (r) => responses.push(r),
      setRequestHistory: (h) => histories.push(h),
      setMockDraft: (d) => mockDrafts.push(d),
      setMockOpen: (o) => mockOpens.push(o),
      setActiveCollection: () => {},
      setActiveRequest: () => {},
      setCollections: () => {},
    },
  });
  return { hub, calls, responses, toasts, histories, mockDrafts, mockOpens, logErrors };
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

describe("openMockModal", () => {
  const LINKED = { ...REQUEST, mockRuleId: "rule-9" };
  const OWNED = {
    ruleId: "rule-9",
    name: "Mock: demo",
    urlPattern: "https://example.test/api",
    method: "GET",
    responseBody: "{\"mock\":true}",
    statusCode: 201,
    contentType: "application/json",
    responseHeaders: { "X-Mock": "yes" },
    enabled: false,
  };

  it("loads the linked own mock into the draft, preserving headers and enabled=false", async () => {
    const { hub, mockDrafts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { getOwnMock: async () => OWNED },
      getState: () => ({ activeRequest: LINKED, activeVariables: {}, response: null }),
    });
    await hub.openMockModal();

    assert.equal(mockDrafts.length, 1);
    assert.deepEqual(mockDrafts[0], { ...OWNED, requestId: "req1", linkedRuleId: "rule-9" });
    assert.equal(mockDrafts[0].enabled, false);
    assert.deepEqual(mockDrafts[0].responseHeaders, { "X-Mock": "yes" });
    assert.deepEqual(mockOpens, [true]);
  });

  it("getOwnMock failure toasts mock_load_failed and opens nothing (no fallback)", async () => {
    const { hub, mockDrafts, mockOpens, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        getOwnMock: async () => {
          throw new Error("Security Violation: foreign rule");
        },
      },
      // A live response exists — still must NOT fall back to a fresh draft.
      getState: () => ({
        activeRequest: LINKED,
        activeVariables: {},
        response: { status: 200, body: "live", headers: {} },
      }),
    });
    await hub.openMockModal();

    assert.equal(mockDrafts.length, 0);
    assert.equal(mockOpens.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_load_failed" && x.type === "error"));
  });

  it("old host without getOwnMock falls back to the response-based draft", async () => {
    const { hub, mockDrafts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {}, // no getOwnMock
      getState: () => ({
        activeRequest: LINKED,
        activeVariables: {},
        response: { status: 418, body: "teapot", headers: { "content-type": "text/plain" } },
      }),
    });
    await hub.openMockModal();

    assert.equal(mockDrafts.length, 1);
    assert.equal(mockDrafts[0].ruleId, "rule-9");
    assert.equal(mockDrafts[0].statusCode, 418);
    assert.equal(mockDrafts[0].contentType, "text/plain");
    assert.equal(mockDrafts[0].responseBody, "teapot");
    assert.deepEqual(mockOpens, [true]);
  });

  it("old host without getOwnMock and no response opens nothing", async () => {
    const { hub, mockDrafts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {},
      getState: () => ({ activeRequest: LINKED, activeVariables: {}, response: null }),
    });
    await hub.openMockModal();
    assert.equal(mockDrafts.length, 0);
    assert.equal(mockOpens.length, 0);
  });

  it("rejects a getOwnMock result whose ruleId does not match the linked id", async () => {
    const { hub, mockDrafts, mockOpens, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { getOwnMock: async () => ({ ...OWNED, ruleId: "other-rule" }) },
      getState: () => ({ activeRequest: LINKED, activeVariables: {}, response: null }),
    });
    await hub.openMockModal();

    assert.equal(mockDrafts.length, 0);
    assert.equal(mockOpens.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_load_failed" && x.type === "error"));
  });

  it("does not leak mock body/headers to logs on a mismatched getOwnMock result", async () => {
    const { hub, toasts, logErrors } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        getOwnMock: async () => ({
          ...OWNED,
          ruleId: "other-rule",
          responseBody: "SECRET_BODY_SENTINEL",
          responseHeaders: { Authorization: "Bearer SECRET_TOKEN_SENTINEL" },
        }),
      },
      getState: () => ({ activeRequest: LINKED, activeVariables: {}, response: null }),
    });
    await hub.openMockModal();

    assert.ok(toasts.some((x) => x.message === "mock_load_failed" && x.type === "error"));
    const logged = JSON.stringify(logErrors);
    assert.ok(!logged.includes("SECRET"), `log must not contain mock payload: ${logged}`);
  });

  it("discards a stale getOwnMock result when the request/link changed", async () => {
    let switched = false;
    const { hub, mockDrafts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        getOwnMock: async () => {
          switched = true; // simulate user switching request during the await
          return OWNED;
        },
      },
      getState: () =>
        switched
          ? { activeRequest: { ...REQUEST, id: "other" }, activeVariables: {}, response: null }
          : { activeRequest: LINKED, activeVariables: {}, response: null },
    });
    await hub.openMockModal();

    assert.equal(mockDrafts.length, 0);
    assert.equal(mockOpens.length, 0);
  });
});

describe("confirmCreateMock", () => {
  const LINKED = { ...REQUEST, mockRuleId: "rule-9" };
  // Draft shaped like one loaded via getOwnMock for a disabled owned mock.
  const LOADED_DRAFT = {
    ruleId: "rule-9",
    name: "Mock: demo",
    urlPattern: "https://example.test/api",
    method: "GET",
    responseBody: "{\"mock\":true}",
    statusCode: 201,
    contentType: "application/json",
    responseHeaders: { "X-Mock": "yes" },
    enabled: false,
    requestId: "req1",
    linkedRuleId: "rule-9",
  };

  it("saves a loaded own mock via createMock with same id and preserved headers", async () => {
    const { hub, calls, mockOpens, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "rule-9" },
      getState: () => ({ activeRequest: LINKED, activeVariables: {} }),
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT });

    assert.equal(calls.createMock.length, 1);
    assert.equal(calls.createMock[0].ruleId, "rule-9");
    assert.deepEqual(calls.createMock[0].responseHeaders, { "X-Mock": "yes" });
    assert.equal(calls.createMock[0].statusCode, 201);
    assert.deepEqual(mockOpens, [false]); // modal closed on success
    assert.ok(toasts.some((x) => x.message === "mock_updated" && x.type === "success"));
  });

  it("keeps the modal open and toasts mock_save_failed when createMock rejects", async () => {
    const { hub, calls, mockOpens, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        createMock: async () => {
          throw new Error("bridge down");
        },
      },
      getState: () => ({ activeRequest: LINKED, activeVariables: {} }),
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT });

    assert.equal(calls.createMock.length, 1);
    assert.equal(mockOpens.length, 0); // never closed
    assert.ok(toasts.some((x) => x.message.startsWith("mock_save_failed") && x.type === "error"));
  });

  it("refuses with mock_context_changed when the request id differs from the draft", async () => {
    const { hub, calls, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "rule-9" },
      getState: () => ({ activeRequest: { ...LINKED, id: "other" }, activeVariables: {} }),
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT });

    assert.equal(calls.createMock.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_context_changed" && x.type === "error"));
  });

  it("refuses with mock_context_changed when the link was removed after opening", async () => {
    const { hub, calls, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "rule-9" },
      getState: () => ({ activeRequest: REQUEST, activeVariables: {} }), // unlinked now
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT });

    assert.equal(calls.createMock.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_context_changed" && x.type === "error"));
  });

  it("refuses a new-mock draft when the request became linked meanwhile", async () => {
    const newDraft = { ...LOADED_DRAFT, ruleId: undefined, linkedRuleId: undefined };
    const { hub, calls, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "new-id" },
      getState: () => ({ activeRequest: LINKED, activeVariables: {} }), // linked now
    });
    await hub.confirmCreateMock(newDraft);

    assert.equal(calls.createMock.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_context_changed" && x.type === "error"));
  });

  it("rejects an out-of-range status code before calling the host", async () => {
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "rule-9" },
      getState: () => ({ activeRequest: LINKED, activeVariables: {} }),
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT, statusCode: "abc" });
    await hub.confirmCreateMock({ ...LOADED_DRAFT, statusCode: 99 });
    await hub.confirmCreateMock({ ...LOADED_DRAFT, statusCode: 600 });

    assert.equal(calls.createMock.length, 0);
    assert.equal(mockOpens.length, 0);
    assert.equal(toasts.filter((x) => x.message === "mock_status_invalid").length, 3);
  });

  it("refuses a linked draft whose ruleId no longer matches the linked id", async () => {
    const { hub, calls, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "rule-9" },
      getState: () => ({ activeRequest: LINKED, activeVariables: {} }),
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT, ruleId: "tampered" });

    assert.equal(calls.createMock.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_context_changed" && x.type === "error"));
  });

  it("does not link when mockRuleId changed while the bridge call was in flight", async () => {
    let switched = false;
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        createMock: async () => {
          switched = true;
          return "rule-9";
        },
      },
      getState: () =>
        switched
          ? { activeRequest: { ...REQUEST, mockRuleId: "other-rule" }, activeVariables: {} }
          : { activeRequest: LINKED, activeVariables: {} },
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT });

    assert.equal(calls.createMock.length, 1);
    assert.equal(calls.saveCollection, 0); // link change detected, no overwrite
    assert.equal(mockOpens.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_link_failed" && x.type === "error"));
  });

  it("reports mock_link_failed when persisting the new link fails", async () => {
    // New draft on an unlinked request; the link write throws.
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "new-rule-id" },
      failSaveCollection: true,
      getState: () => ({
        activeRequest: REQUEST,
        activeCollection: { id: "c1", requests: [REQUEST], folders: [] },
        activeVariables: {},
      }),
    });
    const draft = { ...LOADED_DRAFT, ruleId: undefined, linkedRuleId: undefined, name: "New Mock" };
    await hub.confirmCreateMock(draft);

    assert.equal(calls.createMock.length, 1); // host rule was created
    assert.equal(calls.saveCollection, 1); // link write attempted and failed
    assert.equal(mockOpens.length, 0); // modal stays open
    assert.ok(toasts.some((x) => x.message === "mock_link_failed" && x.type === "error"));
    assert.ok(!toasts.some((x) => x.type === "success"));
  });

  it("retries only the link after a failed attempt — exactly one host createMock", async () => {
    let failSave = true;
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "new-rule-id" },
      failSaveCollection: () => failSave,
      getState: () => ({
        activeRequest: REQUEST,
        activeCollection: { id: "c1", requests: [REQUEST], folders: [] },
        activeVariables: {},
      }),
    });
    const draft = { ...LOADED_DRAFT, ruleId: undefined, linkedRuleId: undefined, name: "New Mock" };

    await hub.confirmCreateMock(draft); // host rule created, link write fails
    assert.ok(toasts.some((x) => x.message === "mock_link_failed" && x.type === "error"));

    failSave = false;
    await hub.confirmCreateMock(draft); // retry — link only, no second createMock

    assert.equal(calls.createMock.length, 1);
    assert.equal(calls.saveCollection, 2);
    assert.deepEqual(mockOpens, [false]); // closed on retry success
    assert.ok(toasts.some((x) => x.message === "mock_created" && x.type === "success"));
  });

  it("updates the same host rule when the draft was edited after a failed link", async () => {
    let failSave = true;
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async (args) => args.ruleId || "new-rule-id" },
      failSaveCollection: () => failSave,
      getState: () => ({
        activeRequest: REQUEST,
        activeCollection: { id: "c1", requests: [REQUEST], folders: [] },
        activeVariables: {},
      }),
    });
    const draft = { ...LOADED_DRAFT, ruleId: undefined, linkedRuleId: undefined, name: "New Mock" };

    await hub.confirmCreateMock(draft); // creates rule, link write fails
    assert.ok(toasts.some((x) => x.message === "mock_link_failed"));

    failSave = false;
    await hub.confirmCreateMock({ ...draft, responseBody: "edited-body" }); // retry with edits

    assert.equal(calls.createMock.length, 2); // update, not a new rule
    assert.equal(calls.createMock[1].ruleId, "new-rule-id"); // SAME host rule
    assert.equal(calls.createMock[1].responseBody, "edited-body");
    assert.equal(calls.saveCollection, 2);
    assert.deepEqual(mockOpens, [false]);
    assert.ok(toasts.some((x) => x.message === "mock_created" && x.type === "success"));
  });

  it("keeps pending and modal open when the edited-rule update fails", async () => {
    let failSave = true;
    let failUpdate = false;
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        createMock: async (args) => {
          if (failUpdate && args.ruleId) throw new Error("update failed");
          return args.ruleId || "new-rule-id";
        },
      },
      failSaveCollection: () => failSave,
      getState: () => ({
        activeRequest: REQUEST,
        activeCollection: { id: "c1", requests: [REQUEST], folders: [] },
        activeVariables: {},
      }),
    });
    const draft = { ...LOADED_DRAFT, ruleId: undefined, linkedRuleId: undefined, name: "New Mock" };

    await hub.confirmCreateMock(draft);
    failUpdate = true;
    failSave = false;
    await hub.confirmCreateMock({ ...draft, responseBody: "edited" }); // update fails

    assert.equal(calls.createMock.length, 2);
    assert.equal(mockOpens.length, 0); // still open
    assert.ok(toasts.some((x) => x.message.startsWith("mock_save_failed") && x.type === "error"));

    failUpdate = false;
    // Pending snapshot still holds the ORIGINAL fields, so the edited draft
    // updates the same rule again before linking.
    await hub.confirmCreateMock({ ...draft, responseBody: "edited" });
    assert.equal(calls.createMock.length, 3);
    assert.equal(calls.createMock[2].ruleId, "new-rule-id");
    assert.deepEqual(mockOpens, [false]);
  });

  it("does not reuse a remembered link for a different request", async () => {
    let failSave = true;
    let currentRequest = REQUEST;
    const { hub, calls, toasts } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: async () => "new-rule-id" },
      failSaveCollection: () => failSave,
      getState: () => ({
        activeRequest: currentRequest,
        activeCollection: { id: "c1", requests: [REQUEST], folders: [] },
        activeVariables: {},
      }),
    });
    const draft = { ...LOADED_DRAFT, ruleId: undefined, linkedRuleId: undefined, name: "New Mock" };

    await hub.confirmCreateMock(draft); // pending link remembered for req1
    assert.equal(calls.createMock.length, 1);

    // Switch to another request — the pending link must not carry over.
    currentRequest = { ...REQUEST, id: "other" };
    failSave = false;
    await hub.confirmCreateMock({ ...draft, requestId: "other" });
    assert.ok(toasts.filter((x) => x.message === "mock_created").length === 1);
    assert.equal(calls.createMock.length, 2); // new rule for the new request context
  });

  it("suppresses a second submission while a save is in flight", async () => {
    let resolveCreate;
    const pending = new Promise((r) => {
      resolveCreate = r;
    });
    const { hub, calls } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: { createMock: () => pending },
      getState: () => ({ activeRequest: LINKED, activeVariables: {} }),
    });
    const first = hub.confirmCreateMock({ ...LOADED_DRAFT });
    const second = hub.confirmCreateMock({ ...LOADED_DRAFT }); // double-click
    resolveCreate("rule-9");
    await Promise.all([first, second]);

    assert.equal(calls.createMock.length, 1); // only one host call
  });

  it("does not link the created rule when the request switched during the bridge call", async () => {
    let switched = false;
    const { hub, calls, toasts, mockOpens } = makeHub({
      send: async () => ({}),
      appendImpl: async () => [],
      rules: {
        createMock: async () => {
          switched = true;
          return "rule-9";
        },
      },
      getState: () =>
        switched
          ? { activeRequest: { ...REQUEST, id: "other" }, activeVariables: {} }
          : { activeRequest: LINKED, activeVariables: {} },
    });
    await hub.confirmCreateMock({ ...LOADED_DRAFT });

    assert.equal(calls.createMock.length, 1); // rule was created on host
    assert.equal(calls.saveCollection, 0); // but never linked to another request
    assert.equal(mockOpens.length, 0);
    assert.ok(toasts.some((x) => x.message === "mock_link_failed" && x.type === "error"));
  });
});
