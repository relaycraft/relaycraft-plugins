/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ApiCollection, ApiRequest, Environment, ImportedApiRequest, PostExtractRule, RunnerResult } from "./types";
import { appendParamsToUrl, applyAuth, buildCurlCommand, extractRequestName, FORM_BODY_TYPE, normalizeRequestBodyType, parseFormBodyItems, resolveVariables as resolveVars, serializeFormBodyItems } from "./utils";
import { isPostmanCollection, parsePostmanCollection } from "./services/postman";

type Deps = {
  storage: any;
  api: any;
  t: (key: string, opts?: Record<string, unknown>) => string;
  parseOpenApi: (spec: any, generateId: () => string) => ImportedApiRequest[];
  generateId: () => string;
  resolveVariables: (text: string, variables: Record<string, string>) => string;
  runnerAbortRef: { current: boolean };
  getState: () => {
    collections: any[];
    activeCollection: ApiCollection | null;
    activeRequest: ApiRequest | null;
    environments: Environment[];
    activeEnvId: string;
    activeVariables: Record<string, string>;
    importFormat: "openapi" | "postman" | "curl";
    importMode: "url" | "paste";
    importUrl: string;
    importText: string;
    importTargetCollectionId: string;
    flowTargetCollectionId: string;
    pendingFlow: any;
    flowRequestName: string;
    response: any;
    requestHistory: any[];
    runnerCollection: ApiCollection | null;
    runnerSelectedIds: string[];
    defaultCollectionId: string | null;
    moveRequestId: string | null;
    moveRequestTargetId: string;
  };
  setState: {
    setCollections: (v: any[]) => void;
    setActiveCollection: (v: ApiCollection | null) => void;
    setActiveRequest: (v: ApiRequest | null) => void;
    setResponse: (v: any) => void;
    setSending: (v: boolean) => void;
    setEnvironments: (v: Environment[]) => void;
    setImportOpen: (v: boolean) => void;
    setImportTargetCollectionId: (v: string) => void;
    setFlowSaveOpen: (v: boolean) => void;
    setPendingFlow: (v: any) => void;
    setRequestHistory: (v: any[]) => void;
    setRunnerOpen: (v: boolean) => void;
    setRunnerCollection: (v: ApiCollection | null) => void;
    setRunnerResults: (v: RunnerResult[]) => void;
    setRunnerRunning: (v: boolean) => void;
    setRunnerSelectedIds: (v: string[]) => void;
    setDefaultCollectionId: (v: string | null) => void;
    setMoveRequestOpen: (v: boolean) => void;
    setMoveRequestId: (v: string | null) => void;
    setMoveRequestTargetId: (v: string) => void;
    setMockOpen: (v: boolean) => void;
    setMockDraft: (v: any) => void;
  };
};

export function createActionHub(deps: Deps) {
  const {
    storage,
    api,
    t,
    parseOpenApi,
    generateId,
    resolveVariables,
    runnerAbortRef,
    getState,
    setState,
  } = deps;

  const normalizeHttpUrl = (input: string) => {
    const trimmed = (input || "").trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  };

  const parseOpenApiDocument = (raw: any) => {
    if (raw && typeof raw === "object") return raw;
    const text = String(raw ?? "").replace(/^\uFEFF/, "").trim();
    if (!text) throw new Error(t("import_empty_body"));
    if (/^<!doctype html/i.test(text) || /^<html/i.test(text)) {
      throw new Error(t("import_html_document_hint"));
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(t("import_invalid_json"));
    }
  };

  const mergeImportedRequests = (
    target: ApiCollection,
    items: ImportedApiRequest[],
    options?: { defaultFolderName?: string; keepUngroupedAtRoot?: boolean },
  ): ApiCollection => {
    const folderNameToFolder = new Map(
      (target.folders || []).map((folder) => [folder.name, { ...folder, requests: [...(folder.requests || [])] }]),
    );
    const nextRootRequests = [...(target.requests || [])];

    for (const item of items) {
      const rawGroupName = String(item.tag || "").trim();
      const groupName =
        rawGroupName || (options?.keepUngroupedAtRoot ? "" : options?.defaultFolderName || "");

      if (!groupName) {
        nextRootRequests.push(item.request);
        continue;
      }

      const existingFolder = folderNameToFolder.get(groupName);
      if (existingFolder) {
        existingFolder.requests.push(item.request);
        continue;
      }

      folderNameToFolder.set(groupName, {
        id: generateId(),
        name: groupName,
        requests: [item.request],
      });
    }

    return {
      ...target,
      requests: nextRootRequests,
      folders: Array.from(folderNameToFolder.values()),
      updatedAt: Date.now(),
    };
  };

  const buildSwaggerUrlCandidates = (inputUrl: string) => {
    const normalized = normalizeHttpUrl(inputUrl);
    if (!normalized) return [] as string[];
    const candidates: string[] = [];
    const push = (url: string) => {
      if (url && !candidates.includes(url)) candidates.push(url);
    };
    push(normalized);
    try {
      const parsed = new URL(normalized);
      const path = parsed.pathname.replace(/\/+$/, "");
      const origin = parsed.origin;
      if (!/\.json$/i.test(path)) {
        push(`${origin}/swagger.json`);
        push(`${origin}/openapi.json`);
        push(`${origin}/v3/api-docs`);
      }
    } catch {
      return candidates;
    }
    return candidates;
  };

  const getResponseHeaderValue = (headers: Record<string, string>, headerName: string) => {
    const lowerName = headerName.toLowerCase();
    const direct = headers[headerName] ?? headers[lowerName];
    if (direct !== undefined && direct !== null) return String(direct);
    const matchedKey = Object.keys(headers).find((k) => k.toLowerCase() === lowerName);
    if (!matchedKey) return null;
    return headers[matchedKey] ?? null;
  };

  const readJsonPath = (path: string, input: any) => {
    const normalized = String(path || "").trim().replace(/^\$\./, "").replace(/^\$/, "");
    if (!normalized) return input;
    const keys = normalized.match(/[^.[\]]+/g) || [];
    return keys.reduce((acc, key) => (acc == null ? undefined : acc[key]), input);
  };

  const extractValue = (rule: PostExtractRule, response: any, parsedBody: any) => {
    if (rule.from === "status") return String(response?.status ?? "");
    if (rule.from === "header") {
      const headerName = String(rule.header || "").trim();
      if (!headerName) return null;
      return getResponseHeaderValue(response?.headers || {}, headerName);
    }
    if (rule.from === "body") {
      const path = String(rule.path || "").trim();
      if (!path) return null;
      const value = readJsonPath(path, parsedBody);
      return value === undefined ? null : value;
    }
    return null;
  };

  function findRequestInCollection(collection: ApiCollection, requestId: string): { request: ApiRequest; folderId: string | null } | null {
    const root = collection.requests.find((x: ApiRequest) => x.id === requestId);
    if (root) return { request: root, folderId: null };
    for (const folder of collection.folders || []) {
      const inFolder = (folder.requests || []).find((x: ApiRequest) => x.id === requestId);
      if (inFolder) return { request: inFolder, folderId: folder.id };
    }
    return null;
  }

  async function runPostExtract(request: ApiRequest, response: any) {
    const rules = Array.isArray(request.postExtract) ? request.postExtract : [];
    if (rules.length === 0) return;
    const { activeEnvId, environments } = getState();
    if (!activeEnvId || activeEnvId === "none") return;
    const envIndex = environments.findIndex((x) => x.id === activeEnvId);
    if (envIndex < 0) return;
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(response?.body || "");
    } catch {
      parsedBody = null;
    }
    let dirty = false;
    const nextVariables = { ...(environments[envIndex]?.variables || {}) };
    for (const rule of rules) {
      const variable = String(rule?.variable || "").trim();
      if (!variable) continue;
      const value = extractValue(rule, response, parsedBody);
      if (value === null || value === undefined) continue;
      nextVariables[variable] = typeof value === "string" ? value : JSON.stringify(value);
      dirty = true;
    }
    if (!dirty) return;
    const nextEnvironments = environments.map((env, idx) =>
      idx === envIndex ? { ...env, variables: nextVariables } : env,
    );
    await storage.saveEnvironments(nextEnvironments);
    setState.setEnvironments(nextEnvironments);
    api.ui.toast(t("post_extract_applied"), "success");
  }

  async function refreshIndexAndMaybeReload(collectionId?: string) {
    const idx = await storage.loadIndex();
    setState.setCollections(idx);
    if (collectionId) {
      const col = await storage.getCollection(collectionId);
      setState.setActiveCollection(col);
    }
  }

  async function createCollection() {
    const col: ApiCollection = {
      id: generateId(),
      name: t("new_collection"),
      folders: [],
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await storage.saveCollection(col);
    await refreshIndexAndMaybeReload(col.id);
    setState.setImportTargetCollectionId(col.id);
  }

  async function deleteCollection(id: string) {
    const { activeCollection } = getState();
    await storage.deleteCollection(id);
    if (activeCollection?.id === id) {
      setState.setActiveCollection(null);
      setState.setActiveRequest(null);
      setState.setResponse(null);
    }
    await refreshIndexAndMaybeReload();
  }

  async function selectCollection(id: string) {
    const col = await storage.getCollection(id);
    setState.setActiveCollection(col);
    setState.setActiveRequest(null);
    setState.setResponse(null);
  }

  async function toggleCollection(id: string) {
    const { activeCollection } = getState();
    if (activeCollection?.id === id) {
      setState.setActiveCollection(null);
      setState.setActiveRequest(null);
      setState.setResponse(null);
      return;
    }
    await selectCollection(id);
  }

  async function addRequest() {
    const { activeCollection } = getState();
    if (!activeCollection) return;
    const req: ApiRequest = {
      id: generateId(),
      name: t("new_request"),
      method: "GET",
      url: "https://api.example.com",
      headers: [],
      body: null,
      bodyType: "none",
      postExtract: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = { ...activeCollection, requests: [...activeCollection.requests, req] };
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    setState.setActiveRequest(req);
    await refreshIndexAndMaybeReload(next.id);
  }

  async function deleteRequest(requestId: string) {
    const { activeCollection, activeRequest } = getState();
    if (!activeCollection) return;
    const found = findRequestInCollection(activeCollection, requestId);
    if (!found) return;
    let next: ApiCollection;
    if (found.folderId === null) {
      next = { ...activeCollection, requests: activeCollection.requests.filter((x) => x.id !== requestId) };
    } else {
      next = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => f.id === found.folderId ? { ...f, requests: (f.requests || []).filter((x: ApiRequest) => x.id !== requestId) } : f) };
    }
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    if (activeRequest?.id === requestId) {
      setState.setActiveRequest(null);
      setState.setResponse(null);
    }
    await refreshIndexAndMaybeReload(next.id);
  }

  async function renameCollection(collectionId: string, name: string) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const { activeCollection } = getState();
    if (activeCollection?.id === collectionId) {
      const next = { ...activeCollection, name: trimmed, updatedAt: Date.now() };
      await storage.saveCollection(next);
      setState.setActiveCollection(next);
      await refreshIndexAndMaybeReload(next.id);
      return;
    }
    const col = await storage.getCollection(collectionId);
    if (!col) return;
    const next = { ...col, name: trimmed, updatedAt: Date.now() };
    await storage.saveCollection(next);
    await refreshIndexAndMaybeReload();
  }

  async function renameRequest(requestId: string, name: string) {
    const { activeCollection, activeRequest } = getState();
    if (!activeCollection) return;
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const found = findRequestInCollection(activeCollection, requestId);
    if (!found) return;
    const updated = { ...found.request, name: trimmed, updatedAt: Date.now() };
    let nextCollection: ApiCollection;
    if (found.folderId === null) {
      nextCollection = { ...activeCollection, requests: activeCollection.requests.map((x) => (x.id === requestId ? updated : x)) };
    } else {
      nextCollection = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => f.id === found.folderId ? { ...f, requests: (f.requests || []).map((x: ApiRequest) => x.id === requestId ? updated : x) } : f) };
    }
    await storage.saveCollection(nextCollection);
    setState.setActiveCollection(nextCollection);
    if (activeRequest?.id === requestId) setState.setActiveRequest(updated);
    await refreshIndexAndMaybeReload(nextCollection.id);
  }

  async function updateRequest(patch: Partial<ApiRequest>) {
    const { activeCollection, activeRequest } = getState();
    if (!activeCollection || !activeRequest) return;
    const nextReq = { ...activeRequest, ...patch, updatedAt: Date.now() };
    const found = findRequestInCollection(activeCollection, activeRequest.id);
    let nextCollection: ApiCollection;
    if (!found || found.folderId === null) {
      nextCollection = { ...activeCollection, requests: activeCollection.requests.map((x) => (x.id === nextReq.id ? nextReq : x)) };
    } else {
      nextCollection = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => f.id === found.folderId ? { ...f, requests: (f.requests || []).map((x: ApiRequest) => x.id === nextReq.id ? nextReq : x) } : f) };
    }
    await storage.saveCollection(nextCollection);
    setState.setActiveCollection(nextCollection);
    setState.setActiveRequest(nextReq);
    await refreshIndexAndMaybeReload(nextCollection.id);
  }

  async function sendRequest() {
    const { activeRequest, activeVariables } = getState();
    if (!activeRequest) return;
    setState.setSending(true);
    const snapshot = {
      name: activeRequest.name,
      method: activeRequest.method,
      url: activeRequest.url,
      headers: activeRequest.headers || [],
      body: activeRequest.body || null,
      bodyType: normalizeRequestBodyType(activeRequest.bodyType),
    };
    const pushHistory = async (result: any) => {
      const nextHistory = await storage.appendRequestHistory({
        id: generateId(),
        sourceRequestId: activeRequest.id,
        createdAt: Date.now(),
        snapshot,
        result: {
          status: Number(result?.status || 0),
          time: Number(result?.time || 0),
          totalBytes: Number(result?.total_bytes || 0),
          body: typeof result?.body === "string" ? result.body.slice(0, 102400) : "",
          headers: result?.headers && typeof result.headers === "object" ? result.headers : {},
        },
      });
      setState.setRequestHistory(nextHistory);
    };
    try {
      const resolvedUrl = resolveVariables(activeRequest.url, activeVariables).trim();
      const resolvedParams = (activeRequest.params || []).map((p) => ({
        key: resolveVariables(p.key, activeVariables),
        value: resolveVariables(p.value, activeVariables),
        enabled: p.enabled !== false,
      }));
      const urlWithParams = appendParamsToUrl(resolvedUrl, resolvedParams);
      const baseUrl = /^https?:\/\//i.test(urlWithParams) ? urlWithParams : `http://${urlWithParams}`;
      let headers = (activeRequest.headers || []).reduce((acc, h) => {
        if (h.enabled && h.key) {
          acc[resolveVariables(h.key, activeVariables)] = resolveVariables(h.value, activeVariables);
        }
        return acc;
      }, {} as Record<string, string>);
      const authResult = applyAuth(activeRequest.auth, headers, baseUrl, (s) => resolveVariables(s, activeVariables));
      headers = authResult.headers;
      const cleanUrl = authResult.url;
      const bodyType = normalizeRequestBodyType(activeRequest.bodyType);
      let body: string | null = null;
      if (!["GET", "HEAD", "OPTIONS"].includes(activeRequest.method)) {
        if (bodyType === "none") {
          body = null;
        } else if (bodyType === FORM_BODY_TYPE) {
          const formItems = parseFormBodyItems(activeRequest.body);
          body = serializeFormBodyItems(formItems);
          const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
          if (!hasContentType) headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else {
          body = activeRequest.body || null;
        }
      }
      const start = Date.now();
      const res = await api.http.send({ method: activeRequest.method, url: cleanUrl, headers, body });
      const finalResponse = { ...res, time: Date.now() - start };
      setState.setResponse(finalResponse);
      await runPostExtract(activeRequest, finalResponse);
      await pushHistory(finalResponse);
    } catch (e: any) {
      const finalResponse = { status: 0, body: e?.message || String(e), headers: {}, time: 0, total_bytes: 0 };
      setState.setResponse(finalResponse);
      await pushHistory(finalResponse);
    } finally {
      setState.setSending(false);
    }
  }

  async function cloneActiveRequest() {
    const { activeCollection, activeRequest } = getState();
    if (!activeCollection || !activeRequest) return;
    const baseName = `${activeRequest.name || t("new_request")} ${t("copy_suffix")}`.trim();
    const allNames = new Set([
      ...activeCollection.requests.map((x) => x.name),
      ...(activeCollection.folders || []).flatMap((f: any) => (f.requests || []).map((x: ApiRequest) => x.name)),
    ]);
    let name = baseName;
    let idx = 2;
    while (allNames.has(name)) { name = `${baseName} ${idx}`; idx += 1; }
    const clone: ApiRequest = { ...activeRequest, id: generateId(), name, createdAt: Date.now(), updatedAt: Date.now() };
    const found = findRequestInCollection(activeCollection, activeRequest.id);
    let next: ApiCollection;
    if (!found || found.folderId === null) {
      const sourceIndex = activeCollection.requests.findIndex((x) => x.id === activeRequest.id);
      const nextRequests = [...activeCollection.requests];
      nextRequests.splice(sourceIndex >= 0 ? sourceIndex + 1 : nextRequests.length, 0, clone);
      next = { ...activeCollection, requests: nextRequests, updatedAt: Date.now() };
    } else {
      next = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => {
        if (f.id !== found.folderId) return f;
        const sourceIndex = (f.requests || []).findIndex((x: ApiRequest) => x.id === activeRequest.id);
        const nextRequests = [...(f.requests || [])];
        nextRequests.splice(sourceIndex >= 0 ? sourceIndex + 1 : nextRequests.length, 0, clone);
        return { ...f, requests: nextRequests };
      }), updatedAt: Date.now() };
    }
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    setState.setActiveRequest(clone);
    await refreshIndexAndMaybeReload(next.id);
    api.ui.toast(t("request_cloned"), "success");
    return clone;
  }

  async function applyHistoryToActiveRequest(historyId: string) {
    const { activeCollection, activeRequest, requestHistory } = getState();
    if (!activeCollection || !activeRequest || !historyId) return;
    const selected = (requestHistory || []).find((x: any) => x.id === historyId);
    if (!selected?.snapshot) return;
    await updateRequest({
      method: selected.snapshot.method || activeRequest.method,
      url: selected.snapshot.url || activeRequest.url,
      headers: Array.isArray(selected.snapshot.headers) ? selected.snapshot.headers : activeRequest.headers,
      body: selected.snapshot.body ?? null,
      bodyType: normalizeRequestBodyType(selected.snapshot.bodyType),
    });
    api.ui.toast(t("history_applied"), "success");
  }

  async function removeRequestHistory(historyId: string) {
    if (!historyId) return;
    const nextHistory = await storage.deleteRequestHistoryItem(historyId);
    setState.setRequestHistory(nextHistory);
    api.ui.toast(t("history_item_deleted"), "success");
  }

  async function clearRequestHistory() {
    const nextHistory = await storage.clearRequestHistory();
    setState.setRequestHistory(nextHistory);
    api.ui.toast(t("history_cleared"), "success");
  }

  async function clearActiveRequestHistory() {
    const { activeRequest } = getState();
    if (!activeRequest?.id) return;
    const nextHistory = await storage.clearRequestHistoryBySource(activeRequest.id);
    setState.setRequestHistory(nextHistory);
    setState.setResponse(null);
    api.ui.toast(t("history_cleared"), "success");
  }

  function openMockModal() {
    const { activeRequest, response } = getState();
    if (!activeRequest || !response) return;
    setState.setMockDraft({
      name: `Mock: ${activeRequest.name}`,
      urlPattern: activeRequest.url.replace(/\{\{[^}]+\}\}/g, "*"),
      method: activeRequest.method,
      statusCode: response.status || 200,
      contentType: response.headers?.["content-type"] || "application/json",
      responseBody: typeof response.body === "string" ? response.body.slice(0, 102400) : "",
    });
    setState.setMockOpen(true);
  }

  async function confirmCreateMock(config: any) {
    await api.rules.createMock({
      name: config.name,
      urlPattern: config.urlPattern,
      method: config.method || undefined,
      responseBody: config.responseBody,
      statusCode: Number(config.statusCode) || 200,
      contentType: config.contentType || "application/json",
    });
    setState.setMockOpen(false);
    api.ui.toast(t("mock_created"), "success");
  }

  async function copyAsCurl() {
    const { activeRequest, activeVariables } = getState();
    if (!activeRequest) return;
    const resolvedParams = (activeRequest.params || []).map((p) => ({
      key: resolveVars(p.key, activeVariables),
      value: resolveVars(p.value, activeVariables),
      enabled: p.enabled !== false,
    }));
    const baseUrl = appendParamsToUrl(resolveVars(activeRequest.url, activeVariables), resolvedParams);
    let resolvedHeaders = (activeRequest.headers || []).map((h) => ({
      key: resolveVars(h.key, activeVariables),
      value: resolveVars(h.value, activeVariables),
      enabled: h.enabled,
    }));
    const authResult = applyAuth(
      activeRequest.auth,
      Object.fromEntries(resolvedHeaders.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])),
      baseUrl,
      (s) => resolveVars(s, activeVariables),
    );
    // Re-merge auth headers back as array entries
    const authHeaderKeys = new Set(Object.keys(authResult.headers).map(k => k.toLowerCase()));
    const originalLowerKeys = new Set(resolvedHeaders.filter(h => h.enabled && h.key).map(h => h.key.toLowerCase()));
    const injectedHeaders = Object.entries(authResult.headers)
      .filter(([k]) => !originalLowerKeys.has(k.toLowerCase()))
      .map(([k, v]) => ({ key: k, value: v as string, enabled: true }));
    void authHeaderKeys;
    const resolved = {
      method: activeRequest.method,
      url: authResult.url,
      headers: [...resolvedHeaders, ...injectedHeaders],
      body: activeRequest.body ? resolveVars(activeRequest.body, activeVariables) : null,
      bodyType: activeRequest.bodyType,
    };
    const command = buildCurlCommand(resolved);
    try {
      await navigator.clipboard.writeText(command);
      api.ui.toast(t("curl_copied"), "success");
    } catch {
      api.ui.toast(command, "info");
    }
  }

  async function importCollection() {
    const {
      activeCollection,
      importFormat,
      importTargetCollectionId,
      importMode,
      importUrl,
      importText,
    } = getState();
    const targetId = importTargetCollectionId || activeCollection?.id;
    if (!targetId) return api.ui.toast(t("import_select_collection"), "error");
    const target = await storage.getCollection(targetId);
    if (!target) return api.ui.toast(t("import_error"), "error");
    try {
      let importedRequests: ImportedApiRequest[] = [];

      if (importFormat === "postman") {
        let doc: any = null;
        if (importMode === "url") {
          const url = normalizeHttpUrl(importUrl);
          if (!url) throw new Error(t("import_invalid_url"));
          const res = await api.http.send({ method: "GET", url });
          const status = Number(res?.status || 0);
          if (status >= 400) throw new Error(`HTTP ${status}`);
          doc = parseOpenApiDocument(res?.body);
        } else {
          doc = parseOpenApiDocument(importText);
        }
        if (!isPostmanCollection(doc)) throw new Error(t("import_not_postman"));
        importedRequests = parsePostmanCollection(doc, generateId);
        if (importedRequests.length === 0) throw new Error(t("import_no_paths"));
      } else {
        // openapi (default)
        let spec: any = null;
        if (importMode === "url") {
          const candidates = buildSwaggerUrlCandidates(importUrl);
          if (candidates.length === 0) throw new Error(t("import_invalid_url"));
          let lastError: any = null;
          for (const candidate of candidates) {
            try {
              const res = await api.http.send({ method: "GET", url: candidate });
              const status = Number(res?.status || 0);
              if (status >= 400) throw new Error(`HTTP ${status}`);
              const parsedDoc = parseOpenApiDocument(res?.body);
              if (!parsedDoc?.paths && !parsedDoc?.openapi && !parsedDoc?.swagger) {
                throw new Error(t("import_not_openapi"));
              }
              spec = parsedDoc;
              break;
            } catch (e: any) {
              lastError = e;
            }
          }
          if (!spec) throw lastError || new Error(t("import_not_openapi"));
        } else {
          spec = parseOpenApiDocument(importText);
        }
        importedRequests = parseOpenApi(spec, generateId);
        if (importedRequests.length === 0) throw new Error(t("import_no_paths"));
      }

      const next =
        importFormat === "postman"
          ? mergeImportedRequests(target, importedRequests, { keepUngroupedAtRoot: true })
          : mergeImportedRequests(target, importedRequests, {
              defaultFolderName: t("import_folder_untagged"),
            });
      await storage.saveCollection(next);
      await refreshIndexAndMaybeReload(next.id);
      setState.setImportOpen(false);
      api.ui.toast(t("import_success", { count: importedRequests.length }), "success");
    } catch (e: any) {
      api.ui.toast(`${t("import_error")}: ${e?.message || String(e)}`, "error");
    }
  }

  // Keep legacy alias for backward compatibility
  const importSwagger = importCollection;

  async function openRunner(collectionId: string) {
    const col = await storage.getCollection(collectionId);
    if (!col) return;
    setState.setRunnerCollection(col);
    const allIds = [
      ...(col.requests || []).map((r: ApiRequest) => r.id),
      ...(col.folders || []).flatMap((f: any) => (f.requests || []).map((r: ApiRequest) => r.id)),
    ];
    setState.setRunnerSelectedIds(allIds);
    setState.setRunnerResults([]);
    setState.setRunnerRunning(false);
    setState.setRunnerOpen(true);
  }

  function stopRunner() {
    runnerAbortRef.current = true;
  }

  async function runCollection({ selectedIds, delay }: { selectedIds: string[]; delay: number }) {
    const { runnerCollection } = getState();
    if (!runnerCollection) return;
    const allRequests = [
      ...(runnerCollection.requests || []),
      ...(runnerCollection.folders || []).flatMap((f: any) => f.requests || []),
    ];
    const requests = allRequests.filter((r: ApiRequest) => selectedIds.includes(r.id));
    if (requests.length === 0) return;

    runnerAbortRef.current = false;
    setState.setRunnerRunning(true);

    // Snapshot active vars; updated locally as extract rules fire so subsequent requests see fresh values
    let currentVars = { ...getState().activeVariables };

    const results: RunnerResult[] = requests.map((r: ApiRequest) => ({
      requestId: r.id,
      name: r.name,
      method: r.method,
      status: null,
      time: null,
      error: null,
      state: "pending",
    }));
    setState.setRunnerResults([...results]);

    for (let i = 0; i < requests.length; i++) {
      if (runnerAbortRef.current) break;

      const req = requests[i];
      results[i] = { ...results[i], state: "running" };
      setState.setRunnerResults([...results]);

      const start = Date.now();
      try {
        const resolvedUrl = resolveVars(req.url, currentVars).trim();
        const cleanUrl = /^https?:\/\//i.test(resolvedUrl) ? resolvedUrl : `http://${resolvedUrl}`;
        const headers = (req.headers || []).reduce((acc: Record<string, string>, h: any) => {
          if (h.enabled && h.key) {
            acc[resolveVars(h.key, currentVars)] = resolveVars(h.value, currentVars);
          }
          return acc;
        }, {});
        const bodyType = normalizeRequestBodyType(req.bodyType);
        let body: string | null = null;
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
          if (bodyType === FORM_BODY_TYPE) {
            const formItems = parseFormBodyItems(req.body);
            body = serializeFormBodyItems(formItems);
            if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
              headers["Content-Type"] = "application/x-www-form-urlencoded";
            }
          } else if (bodyType === "raw") {
            body = req.body || null;
          }
        }
        const res = await api.http.send({ method: req.method, url: cleanUrl, headers, body });
        results[i] = {
          ...results[i],
          status: Number(res?.status || 0),
          time: Date.now() - start,
          state: "done",
          error: null,
        };
        // Apply extract rules: persist to storage AND update local vars for subsequent requests
        if (Array.isArray(req.postExtract) && req.postExtract.length > 0) {
          await runPostExtract(req, res);
          let parsedBody: any = null;
          try { parsedBody = JSON.parse(res?.body || ""); } catch {}
          for (const rule of req.postExtract) {
            const variable = String(rule?.variable || "").trim();
            if (!variable) continue;
            const value = extractValue(rule, res, parsedBody);
            if (value !== null && value !== undefined) {
              currentVars[variable] = typeof value === "string" ? value : JSON.stringify(value);
            }
          }
        }
      } catch (e: any) {
        results[i] = {
          ...results[i],
          status: null,
          time: Date.now() - start,
          error: e?.message || String(e),
          state: "error",
        };
      }
      setState.setRunnerResults([...results]);

      if (delay > 0 && i < requests.length - 1 && !runnerAbortRef.current) {
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }

    setState.setRunnerRunning(false);
  }

  async function toggleDefaultCollection(collectionId: string) {
    const { defaultCollectionId } = getState();
    const next = defaultCollectionId === collectionId ? null : collectionId;
    await storage.saveDefaultCollectionId(next);
    setState.setDefaultCollectionId(next);
  }

  async function saveFlowDirect(flow: any, collectionId: string) {
    const target = await storage.getCollection(collectionId);
    if (!target) return;
    const req: ApiRequest = {
      id: generateId(),
      name: extractRequestName(flow.method || "GET", flow.url || ""),
      method: flow.method || "GET",
      url: flow.url || "",
      headers: Object.entries(flow.headers || {}).map(([key, value]) => ({
        key,
        value: String(value),
        enabled: true,
      })),
      body: flow.body || null,
      bodyType: flow.body ? "raw" : "none",
      postExtract: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = { ...target, requests: [...target.requests, req] };
    await storage.saveCollection(next);
    await refreshIndexAndMaybeReload(next.id);
    api.ui.toast(t("saved_to_collection"), "success");
  }

  async function moveRequestToCollection(requestId: string, targetCollectionId: string) {
    const { activeCollection, activeRequest } = getState();
    if (!activeCollection || activeCollection.id === targetCollectionId) return;
    const found = findRequestInCollection(activeCollection, requestId);
    if (!found) return;
    const target = await storage.getCollection(targetCollectionId);
    if (!target) {
      api.ui.toast(t("import_error"), "error");
      return;
    }

    const movedRequest: ApiRequest = { ...found.request, updatedAt: Date.now() };
    const sourceNext: ApiCollection =
      found.folderId === null
        ? {
            ...activeCollection,
            requests: activeCollection.requests.filter((x) => x.id !== requestId),
          }
        : {
            ...activeCollection,
            folders: (activeCollection.folders || []).map((folder) =>
              folder.id === found.folderId
                ? { ...folder, requests: (folder.requests || []).filter((x) => x.id !== requestId) }
                : folder,
            ),
          };
    const targetNext: ApiCollection = {
      ...target,
      requests: [...(target.requests || []), movedRequest],
    };

    try {
      // Save target first to avoid "removed from source but not written to target".
      await storage.saveCollection(targetNext);
      try {
        await storage.saveCollection(sourceNext);
      } catch (saveSourceError) {
        // Best-effort rollback target when source save fails.
        await storage.saveCollection(target);
        throw saveSourceError;
      }
    } catch (error: any) {
      api.ui.toast(`${t("import_error")}: ${error?.message || String(error)}`, "error");
      return;
    }

    setState.setActiveCollection(sourceNext);
    if (activeRequest?.id === requestId) {
      setState.setActiveRequest(null);
      setState.setResponse(null);
    }
    await refreshIndexAndMaybeReload(sourceNext.id);
    setState.setMoveRequestOpen(false);
    setState.setMoveRequestId(null);
    api.ui.toast(t("request_moved"), "success");
  }

  async function saveFlowToCollection() {
    const { flowTargetCollectionId, pendingFlow, flowRequestName } = getState();
    const target = await storage.getCollection(flowTargetCollectionId);
    if (!target || !pendingFlow) return;
    const req: ApiRequest = {
      id: generateId(),
      name: flowRequestName || `${pendingFlow.method || "GET"} ${pendingFlow.url || ""}`,
      method: pendingFlow.method || "GET",
      url: pendingFlow.url || "",
      headers: Object.entries(pendingFlow.headers || {}).map(([key, value]) => ({
        key,
        value: String(value),
        enabled: true,
      })),
      body: pendingFlow.body || null,
      bodyType: pendingFlow.body ? "raw" : "none",
      postExtract: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = { ...target, requests: [...target.requests, req] };
    await storage.saveCollection(next);
    await refreshIndexAndMaybeReload(next.id);
    setState.setFlowSaveOpen(false);
    setState.setPendingFlow(null);
    api.ui.toast(t("saved_to_collection"), "success");
  }

  async function addFolder() {
    const { activeCollection } = getState();
    if (!activeCollection) return null;
    const folder = { id: generateId(), name: t("new_folder"), requests: [] };
    const next = { ...activeCollection, folders: [...(activeCollection.folders || []), folder] };
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    await refreshIndexAndMaybeReload(next.id);
    return folder;
  }

  async function deleteFolder(folderId: string) {
    const { activeCollection, activeRequest } = getState();
    if (!activeCollection) return;
    const folder = (activeCollection.folders || []).find((f: any) => f.id === folderId);
    const next = { ...activeCollection, folders: (activeCollection.folders || []).filter((f: any) => f.id !== folderId) };
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    if (activeRequest && (folder?.requests || []).some((r: ApiRequest) => r.id === activeRequest.id)) {
      setState.setActiveRequest(null);
      setState.setResponse(null);
    }
    await refreshIndexAndMaybeReload(next.id);
  }

  async function renameFolder(folderId: string, name: string) {
    const { activeCollection } = getState();
    if (!activeCollection) return;
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const next = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => f.id === folderId ? { ...f, name: trimmed } : f) };
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    await refreshIndexAndMaybeReload(next.id);
  }

  async function addRequestToFolder(folderId: string) {
    const { activeCollection } = getState();
    if (!activeCollection) return;
    const req: ApiRequest = { id: generateId(), name: t("new_request"), method: "GET", url: "https://api.example.com", headers: [], body: null, bodyType: "none", postExtract: [], createdAt: Date.now(), updatedAt: Date.now() };
    const next = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => f.id === folderId ? { ...f, requests: [...(f.requests || []), req] } : f) };
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
    setState.setActiveRequest(req);
    await refreshIndexAndMaybeReload(next.id);
  }

  async function reorderCollections(fromId: string, toId: string) {
    const { collections } = getState();
    if (fromId === toId) return;
    const reordered = [...collections];
    const fromIdx = reordered.findIndex((x: any) => x.id === fromId);
    const toIdx = reordered.findIndex((x: any) => x.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, item);
    await storage.saveIndex(reordered);
    setState.setCollections(reordered);
  }

  async function reorderFolders(fromId: string, toId: string) {
    const { activeCollection } = getState();
    if (!activeCollection || fromId === toId) return;
    const folders = [...(activeCollection.folders || [])];
    const fromIdx = folders.findIndex((f: any) => f.id === fromId);
    const toIdx = folders.findIndex((f: any) => f.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = folders.splice(fromIdx, 1);
    folders.splice(toIdx, 0, item);
    const next = { ...activeCollection, folders };
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
  }

  async function reorderRequests(fromId: string, toId: string) {
    const { activeCollection } = getState();
    if (!activeCollection || fromId === toId) return;
    const fromFound = findRequestInCollection(activeCollection, fromId);
    const toFound = findRequestInCollection(activeCollection, toId);
    if (!fromFound || !toFound || fromFound.folderId !== toFound.folderId) return;
    let next: ApiCollection;
    if (fromFound.folderId === null) {
      const reqs = [...activeCollection.requests];
      const fromIdx = reqs.findIndex((x) => x.id === fromId);
      const toIdx = reqs.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [item] = reqs.splice(fromIdx, 1);
      reqs.splice(toIdx, 0, item);
      next = { ...activeCollection, requests: reqs };
    } else {
      next = { ...activeCollection, folders: (activeCollection.folders || []).map((f: any) => {
        if (f.id !== fromFound.folderId) return f;
        const reqs = [...(f.requests || [])];
        const fromIdx = reqs.findIndex((x: ApiRequest) => x.id === fromId);
        const toIdx = reqs.findIndex((x: ApiRequest) => x.id === toId);
        if (fromIdx < 0 || toIdx < 0) return f;
        const [item] = reqs.splice(fromIdx, 1);
        reqs.splice(toIdx, 0, item);
        return { ...f, requests: reqs };
      }) };
    }
    await storage.saveCollection(next);
    setState.setActiveCollection(next);
  }

  return {
    refreshIndexAndMaybeReload,
    createCollection,
    deleteCollection,
    selectCollection,
    toggleCollection,
    addRequest,
    deleteRequest,
    renameCollection,
    renameRequest,
    updateRequest,
    sendRequest,
    cloneActiveRequest,
    applyHistoryToActiveRequest,
    removeRequestHistory,
    clearRequestHistory,
    clearActiveRequestHistory,
    openMockModal,
    confirmCreateMock,
    copyAsCurl,
    importCollection,
    importSwagger,
    saveFlowToCollection,
    openRunner,
    stopRunner,
    runCollection,
    toggleDefaultCollection,
    saveFlowDirect,
    moveRequestToCollection,
    addFolder,
    deleteFolder,
    renameFolder,
    addRequestToFolder,
    reorderCollections,
    reorderFolders,
    reorderRequests,
  };
}
