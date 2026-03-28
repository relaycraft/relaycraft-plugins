/* eslint-disable @typescript-eslint/no-explicit-any */
import "./plugin.css";
import { parseOpenApi } from "./services/openapi";
import { ApiManagerStorage } from "./services/storage";
import { createActionHub } from "./actionHub";
import type { ApiCollection, ApiRequest, CollectionMeta, Environment } from "./types";
import { createIcons } from "./ui/icons";
import { renderRequestEditor, renderResponsePanel, renderSidebar } from "./ui/panels";
import { renderEnvModal, renderFlowModal, renderImportModal, renderMockModal, renderMoveRequestModal, renderRunnerModal } from "./ui/modals";
import { extractRequestName, generateId, PRESET_ENV_VARIABLES, resolveVariables } from "./utils";

(() => {
  type ReactLike = {
    createElement: (...args: any[]) => any;
    useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
    useMemo: <T>(factory: () => T, deps: any[]) => T;
    useRef: <T>(initialValue: T) => { current: T };
    useState: <T>(initialValue: T) => [T, (value: T | ((prev: T) => T)) => void];
  };
  const RelayCraft = (globalThis as any).RelayCraft;
  const ReactRef = (globalThis as any).React as ReactLike;
  if (!RelayCraft || !ReactRef) return;

  const { api, components: CoreComponents, icons: HostIcons } = RelayCraft;
  const { Button, Input, Textarea, Select, Tabs, TabsList, TabsTrigger, TabsContent, Tooltip } = CoreComponents || {};
  const { Editor } = api.ui?.components || {};
  const t = (k: string, opts?: Record<string, unknown>) => (api.i18n?.t ? api.i18n.t(k, opts) : k);
  const el = ReactRef.createElement;
  const { useEffect, useMemo, useRef, useState } = ReactRef;

  const icons = createIcons(el, HostIcons);
  const storage = new ApiManagerStorage(api);

  // Mirrors defaultCollectionId React state so context menu can read it without App being mounted
  let _defaultCollectionId: string | null = null;
  // Callback set by App to refresh the sidebar after a direct save
  let _refreshCollections: (() => void) | null = null;

  async function saveToBestCollection(flow: any) {
    const index = await storage.loadIndex();
    let targetId: string | null = null;

    // 1. Use default collection if it still exists
    if (_defaultCollectionId && index.some((c: any) => c.id === _defaultCollectionId)) {
      targetId = _defaultCollectionId;
    }
    // 2. Fall back to first collection
    if (!targetId && index.length > 0) {
      targetId = index[0].id;
    }
    // 3. No collections at all — auto-create one
    if (!targetId) {
      const newCol: ApiCollection = {
        id: generateId(),
        name: t("default_collection_name"),
        folders: [],
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storage.saveCollection(newCol);
      targetId = newCol.id;
    }

    const target = await storage.getCollection(targetId);
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
    _refreshCollections?.();
    api.ui.toast(t("saved_to_collection_named", { name: target.name }), "success");
  }

  // Unregister any previous instance first (guards against hot-reload double-registration)
  const _prevUnregister: (() => void) | undefined = (globalThis as any).__AM_UNREGISTER_CTX_MENU;
  _prevUnregister?.();
  const _unregisterCtxMenu = api.ui.registerContextMenuItem?.({
    id: "save-to-collection",
    label: () => t("save_to_collection_title"),
    icon: HostIcons?.BookmarkPlus || HostIcons?.Bookmark,
    onClick: (flow: any) => {
      void saveToBestCollection(flow).catch((e: any) =>
        api.ui.toast(`${t("import_error")}: ${e?.message || String(e)}`, "error"),
      );
    },
  });
  (globalThis as any).__AM_UNREGISTER_CTX_MENU = _unregisterCtxMenu;

  const App = () => {
    const [collections, setCollections] = useState<CollectionMeta[]>([]);
    const [activeCollection, setActiveCollection] = useState<ApiCollection | null>(null);
    const [activeRequest, setActiveRequest] = useState<ApiRequest | null>(null);
    const [response, setResponse] = useState<any>(null);
    const [sending, setSending] = useState(false);
    const [proxyActive, setProxyActive] = useState(true);

    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [globalVariables, setGlobalVariables] = useState<Record<string, string>>({});
    const [activeEnvId, setActiveEnvId] = useState("none");
    const [envOpen, setEnvOpen] = useState(false);
    const [envDraft, setEnvDraft] = useState<Environment[]>([]);
    const [globalDraft, setGlobalDraft] = useState<Record<string, string>>({});
    const [envEditingId, setEnvEditingId] = useState<string | null>(null);

    const [importOpen, setImportOpen] = useState(false);
    const [importFormat, setImportFormat] = useState<"openapi" | "postman">("openapi");
    const [importMode, setImportMode] = useState<"url" | "paste">("url");
    const [importUrl, setImportUrl] = useState("");
    const [importText, setImportText] = useState("");
    const [importTargetCollectionId, setImportTargetCollectionId] = useState("");

    const [flowSaveOpen, setFlowSaveOpen] = useState(false);
    const [pendingFlow, setPendingFlow] = useState<any>(null);
    const [flowTargetCollectionId, setFlowTargetCollectionId] = useState("");
    const [flowRequestName, setFlowRequestName] = useState("");
    const [requestHistory, setRequestHistory] = useState<any[]>([]);
    const [runnerOpen, setRunnerOpen] = useState(false);
    const [runnerCollection, setRunnerCollection] = useState<any>(null);
    const [runnerResults, setRunnerResults] = useState<any[]>([]);
    const [runnerRunning, setRunnerRunning] = useState(false);
    const [runnerDelay, setRunnerDelay] = useState(300);
    const [runnerSelectedIds, setRunnerSelectedIds] = useState<string[]>([]);
    const [defaultCollectionId, setDefaultCollectionId] = useState<string | null>(null);
    const [moveRequestOpen, setMoveRequestOpen] = useState(false);
    const [moveRequestId, setMoveRequestId] = useState<string | null>(null);
    const [moveRequestTargetId, setMoveRequestTargetId] = useState("");
    const [mockOpen, setMockOpen] = useState(false);
    const [mockDraft, setMockDraft] = useState<any>(null);
    const [historySelection, setHistorySelection] = useState("");
    const [responseTab, setResponseTab] = useState<"body" | "headers">("body");
    const [recentClonedRequestId, setRecentClonedRequestId] = useState("");
    const [requestSearch, setRequestSearch] = useState("");
    const [hoveredCollectionId, setHoveredCollectionId] = useState("");
    const [hoveredRequestId, setHoveredRequestId] = useState("");
    const [openedFolderIds, setOpenedFolderIds] = useState<string[]>([]);
    const [renameTarget, setRenameTarget] = useState<null | { kind: "collection" | "request" | "folder"; id: string }>(null);
    const [renameDraft, setRenameDraft] = useState("");
    const [dragVisual, setDragVisual] = useState<{ dragType: string; dragId: string; targetType: string; targetId: string } | null>(null);
    const skipRenameBlurCommit = useRef(false);
    const runnerAbortRef = useRef(false);

    const withPresetGlobalVariables = (variables: Record<string, string>) => {
      const next = { ...(variables || {}) };
      let changed = false;
      for (const preset of PRESET_ENV_VARIABLES) {
        if (Object.prototype.hasOwnProperty.call(next, preset.key)) continue;
        next[preset.key] = preset.value;
        changed = true;
      }
      return { variables: next, changed };
    };

    const updateActiveEnvId = (nextId: string) => {
      const normalized = nextId || "none";
      setActiveEnvId(normalized);
      void storage.saveActiveEnvironmentId(normalized);
    };

    const cancelRename = () => {
      setRenameTarget(null);
      setRenameDraft("");
      skipRenameBlurCommit.current = false;
    };

    useEffect(() => {
      (async () => {
        const [idx, envs, history, globalVars, storedActiveEnvId, storedDefaultCollectionId, session] = await Promise.all([
          storage.loadIndex(),
          storage.getEnvironments(),
          storage.getRequestHistory(),
          storage.getGlobalVariables(),
          storage.getActiveEnvironmentId(),
          storage.getDefaultCollectionId(),
          storage.getActiveSession(),
        ]);
        const { variables: hydratedGlobalVars, changed: presetChanged } = withPresetGlobalVariables(globalVars || {});
        const resolvedActiveEnvId =
          storedActiveEnvId === "none"
            ? "none"
            : envs.some((env: Environment) => env.id === storedActiveEnvId)
              ? storedActiveEnvId
              : envs[0]?.id || "none";
        setCollections(idx);
        setEnvironments(envs);
        setRequestHistory(history);
        setGlobalVariables(hydratedGlobalVars);
        setActiveEnvId(resolvedActiveEnvId);
        setDefaultCollectionId(storedDefaultCollectionId);
        if (session?.collectionId) {
          const col = await storage.getCollection(session.collectionId);
          if (col) {
            setActiveCollection(col);
            if (session.requestId) {
              let req: any = col.requests.find((r: any) => r.id === session.requestId);
              if (!req) {
                for (const folder of col.folders || []) {
                  req = (folder.requests || []).find((r: any) => r.id === session.requestId);
                  if (req) break;
                }
              }
              if (req) setActiveRequest(req);
            }
          }
        }
        if (presetChanged) {
          await storage.saveGlobalVariables(hydratedGlobalVars);
        }
        if (resolvedActiveEnvId !== storedActiveEnvId) {
          await storage.saveActiveEnvironmentId(resolvedActiveEnvId);
        }
      })().catch((e) => api.log?.error?.("api-manager init failed", e));
    }, []);

    useEffect(() => {
      if (!envOpen) return;
      const cloned = environments.map((x: Environment) => ({ ...x, variables: { ...(x.variables || {}) } }));
      setEnvDraft(cloned);
      setGlobalDraft({ ...(globalVariables || {}) });
      setEnvEditingId(cloned[0]?.id || null);
    }, [envOpen, environments, globalVariables]);

    // Persist active collection/request across page navigations
    useEffect(() => {
      void storage.saveActiveSession(activeCollection?.id ?? null, activeRequest?.id ?? null);
    }, [activeCollection?.id, activeRequest?.id]);

    // Keep module-level mirror of defaultCollectionId in sync
    useEffect(() => {
      _defaultCollectionId = defaultCollectionId;
    }, [defaultCollectionId]);

    // Provide a refresh callback so direct saves can update the sidebar when App is mounted
    useEffect(() => {
      _refreshCollections = () => void actionHub.refreshIndexAndMaybeReload();
      return () => {
        _refreshCollections = null;
      };
    }, []);

    useEffect(() => {
      if (!recentClonedRequestId) return;
      const timer = window.setTimeout(() => setRecentClonedRequestId(""), 1400);
      return () => window.clearTimeout(timer);
    }, [recentClonedRequestId]);

    useEffect(() => {
      if (!recentClonedRequestId) return;
      const reqId = recentClonedRequestId;
      const rafId = window.requestAnimationFrame(() => {
        const target = document.querySelector(`[data-am-request-id="${reqId}"]`) as HTMLElement | null;
        target?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      });
      return () => window.cancelAnimationFrame(rafId);
    }, [recentClonedRequestId, activeCollection, requestSearch]);

    useEffect(() => {
      let disposed = false;
      const refreshProxyState = async () => {
        try {
          if (!api.proxy?.getStatus) {
            if (!disposed) setProxyActive(true);
            return;
          }
          const status = await api.proxy.getStatus();
          if (!disposed) setProxyActive(Boolean(status?.running && status?.active));
        } catch {
          if (!disposed) setProxyActive(false);
        }
      };
      void refreshProxyState();
      const timer = window.setInterval(() => {
        void refreshProxyState();
      }, 2000);
      return () => {
        disposed = true;
        window.clearInterval(timer);
      };
    }, []);

    const activeVariables = useMemo(() => {
      const env = environments.find((x: Environment) => x.id === activeEnvId);
      return { ...(globalVariables || {}), ...(env?.variables || {}) };
    }, [activeEnvId, environments, globalVariables]);

    const actionHub = createActionHub({
      storage,
      api,
      t,
      parseOpenApi,
      generateId,
      resolveVariables,
      runnerAbortRef,
      getState: () => ({
        collections,
        activeCollection,
        activeRequest,
        environments,
        globalVariables,
        activeEnvId,
        activeVariables,
        importFormat,
        importMode,
        importUrl,
        importText,
        importTargetCollectionId,
        flowTargetCollectionId,
        pendingFlow,
        flowRequestName,
        response,
        requestHistory,
        runnerCollection,
        runnerSelectedIds,
        defaultCollectionId,
        moveRequestId,
        moveRequestTargetId,
      }),
      setState: {
        setCollections,
        setActiveCollection,
        setActiveRequest,
        setResponse,
        setSending,
        setEnvironments,
        setImportOpen,
        setImportTargetCollectionId,
        setFlowSaveOpen,
        setPendingFlow,
        setRequestHistory,
        setRunnerOpen,
        setRunnerCollection,
        setRunnerResults,
        setRunnerRunning,
        setRunnerSelectedIds,
        setDefaultCollectionId,
        setMoveRequestOpen,
        setMoveRequestId,
        setMoveRequestTargetId,
        setMockOpen,
        setMockDraft,
      },
    });

    const commitRename = async () => {
      if (!renameTarget) return;
      const draft = renameDraft.trim();
      if (!draft) {
        cancelRename();
        return;
      }
      if (renameTarget.kind === "collection") {
        await actionHub.renameCollection(renameTarget.id, draft);
      } else if (renameTarget.kind === "folder") {
        await actionHub.renameFolder(renameTarget.id, draft);
      } else {
        await actionHub.renameRequest(renameTarget.id, draft);
      }
      cancelRename();
    };

    const onRenameKeyDown = (e: any) => {
      if (e.key === "Escape") {
        skipRenameBlurCommit.current = true;
        cancelRename();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void commitRename();
      }
    };

    const onRenameBlur = () => {
      if (skipRenameBlurCommit.current) {
        skipRenameBlurCommit.current = false;
        return;
      }
      void commitRename();
    };

    return el(
      "div",
      { className: "api-manager-root h-full w-full flex bg-background text-foreground" },
      renderSidebar({
        el,
        t,
        Button,
        Input,
        Select,
        Tooltip,
        icons,
        state: { collections, activeCollection, activeRequest, environments, activeEnvId, requestSearch, renameTarget, renameDraft, recentClonedRequestId, hoveredCollectionId, hoveredRequestId, defaultCollectionId, openedFolderIds, dragVisual },
        actions: {
          setActiveEnvId: updateActiveEnvId,
          setRequestSearch,
          setHoveredCollectionId,
          setHoveredRequestId,
          setRenameDraft,
          startRenameCollection: (id: string, name: string) => {
            setRenameTarget({ kind: "collection", id });
            setRenameDraft(name);
          },
          startRenameRequest: (id: string, name: string) => {
            setRenameTarget({ kind: "request", id });
            setRenameDraft(name);
          },
          startRenameFolder: (id: string, name: string) => {
            setRenameTarget({ kind: "folder", id });
            setRenameDraft(name);
          },
          onRenameBlur,
          onRenameKeyDown,
          createCollection: actionHub.createCollection,
          setEnvOpen,
          setImportOpen,
          selectCollection: actionHub.toggleCollection,
          setActiveRequest: (r: any) => {
            if (r?.id !== activeRequest?.id) {
              setResponse(null);
              setHistorySelection("");
            }
            setActiveRequest(r);
          },
          deleteCollection: actionHub.deleteCollection,
          deleteRequest: actionHub.deleteRequest,
          addRequest: actionHub.addRequest,
          openRunner: actionHub.openRunner,
          toggleDefaultCollection: actionHub.toggleDefaultCollection,
          openMoveRequest: (requestId: string) => {
            setMoveRequestId(requestId);
            setMoveRequestTargetId("");
            setMoveRequestOpen(true);
          },
          addFolder: async () => {
            const folder = await actionHub.addFolder();
            if (folder?.id) {
              setOpenedFolderIds((prev: string[]) => prev.includes(folder.id) ? prev : [...prev, folder.id]);
              setRenameTarget({ kind: "folder", id: folder.id });
              setRenameDraft(folder.name);
            }
          },
          deleteFolder: actionHub.deleteFolder,
          addRequestToFolder: actionHub.addRequestToFolder,
          toggleFolder: (folderId: string) => {
            setOpenedFolderIds((prev: string[]) => prev.includes(folderId) ? prev.filter((x: string) => x !== folderId) : [...prev, folderId]);
          },
          reorderCollections: actionHub.reorderCollections,
          reorderFolders: actionHub.reorderFolders,
          reorderRequests: actionHub.reorderRequests,
          setDragVisual,
        },
      }),
      el(
        "div",
        { className: "am-content-area flex-1 flex flex-col min-h-0 overflow-hidden" },
        renderRequestEditor({
          el,
          t,
          Button,
          Input,
          Textarea,
          Select,
          Tabs,
          TabsList,
          TabsTrigger,
          TabsContent,
          Editor,
          Tooltip,
          icons,
          state: { activeRequest, sending, collections, activeCollection, proxyActive },
          actions: {
            updateRequest: actionHub.updateRequest,
            sendRequest: async () => {
              if (!proxyActive) {
                api.ui.toast(t("send_disabled_proxy_inactive"), "warning");
                return;
              }
              await actionHub.sendRequest();
            },
            copyAsCurl: actionHub.copyAsCurl,
            cloneActiveRequest: async () => {
              const cloned = await actionHub.cloneActiveRequest();
              if (cloned?.id) setRecentClonedRequestId(cloned.id);
            },
          },
        }),
        renderResponsePanel({
          el,
          t,
          Button,
          Select,
          Editor,
          Tooltip,
          icons,
          state: { response, activeRequest, requestHistory, historySelection, responseTab },
          actions: {
            openMockModal: actionHub.openMockModal,
            setHistorySelection,
            setResponseTab,
            applyHistoryToActiveRequest: actionHub.applyHistoryToActiveRequest,
            removeRequestHistory: async (id: string) => {
              await actionHub.removeRequestHistory(id);
              if (id === historySelection) setHistorySelection("");
            },
            clearActiveRequestHistory: async () => {
              await actionHub.clearActiveRequestHistory();
              setHistorySelection("");
            },
          },
        }),
      ),
      renderImportModal({
        el,
        t,
        Button,
        Input,
        Textarea,
        Select,
        Editor,
        icons,
        state: { importOpen, importFormat, importMode, importUrl, importText, importTargetCollectionId, collections },
        actions: {
          setImportOpen,
          setImportFormat,
          setImportMode,
          setImportUrl,
          setImportText,
          setImportTargetCollectionId,
          importCollection: actionHub.importCollection,
        },
      }),
      renderFlowModal({
        el,
        t,
        Button,
        Input,
        Select,
        icons,
        state: { flowSaveOpen, flowRequestName, flowTargetCollectionId, collections },
        actions: {
          setFlowSaveOpen,
          setFlowRequestName,
          setFlowTargetCollectionId,
          saveFlowToCollection: actionHub.saveFlowToCollection,
        },
      }),
      renderEnvModal({
        el,
        t,
        Button,
        Input,
        icons,
        state: { envOpen, envDraft, globalDraft, envEditingId, activeEnvId },
        actions: { setEnvOpen, setEnvDraft, setGlobalDraft, setEnvEditingId, setEnvironments, setGlobalVariables, setActiveEnvId: updateActiveEnvId, storage },
      }),
      renderRunnerModal({
        el,
        t,
        Button,
        icons,
        state: { runnerOpen, runnerCollection, runnerResults, runnerRunning, runnerDelay, runnerSelectedIds },
        actions: {
          setRunnerOpen,
          setRunnerSelectedIds,
          setRunnerDelay,
          runCollection: actionHub.runCollection,
          stopRunner: actionHub.stopRunner,
        },
      }),
      renderMoveRequestModal({
        el,
        t,
        Button,
        icons,
        state: { moveRequestOpen, moveRequestId, moveRequestTargetId, collections, activeCollection },
        actions: {
          setMoveRequestOpen,
          setMoveRequestTargetId,
          moveRequestToCollection: actionHub.moveRequestToCollection,
        },
      }),
      renderMockModal({
        el,
        t,
        Button,
        Input,
        Select,
        Editor,
        icons,
        state: { mockOpen, mockDraft },
        actions: {
          setMockOpen,
          setMockDraft,
          confirmCreateMock: actionHub.confirmCreateMock,
        },
      }),
    );
  };

  api.ui.registerPage({
    id: "api-manager",
    name: t("title"),
    route: "/api-manager",
    component: App,
    icon: icons.BookOpen,
    order: 10,
  });
})();
