/* eslint-disable @typescript-eslint/no-explicit-any */
import { FORM_BODY_TYPE, normalizeRequestBodyType, parseFormBodyItems } from "../utils";
import type { ApiRequest, AuthConfig, ParamItem } from "../types";

// Module-level drag state — survives React re-renders (dataTransfer.getData is unreliable in VSCode webviews)
let _drag: { type: string; id: string } | null = null;
let _dragOverTarget: { type: string; id: string } | null = null;
let _pointerDragging = false;
let _pointerCandidate: { type: string; id: string; startX: number; startY: number } | null = null;
let _suppressClickUntil = 0;

export function renderSidebar(ctx: any) {
  const { el, t, Button, Input, Select, Tooltip, icons, state, actions } = ctx;
  const tip = (
    content: string,
    child: any,
    options?: { side?: "top" | "bottom" | "left" | "right"; className?: string; multiline?: boolean },
  ) => (Tooltip && !state.dragVisual?.dragId ? el(Tooltip, { content, ...options }, child) : child);
  const { collections, activeCollection, activeRequest, environments, activeEnvId, requestSearch, renameTarget, renameDraft, recentClonedRequestId, hoveredCollectionId, hoveredRequestId, defaultCollectionId, openedFolderIds, dragVisual } = state;
  const {
    setActiveEnvId,
    setRequestSearch,
    setHoveredCollectionId,
    setHoveredRequestId,
    setRenameDraft,
    startRenameCollection,
    startRenameRequest,
    startRenameFolder,
    onRenameBlur,
    onRenameKeyDown,
    createCollection,
    setEnvOpen,
    setImportOpen,
    selectCollection,
    setActiveRequest,
    deleteCollection,
    deleteRequest,
    addRequest,
    openRunner,
    toggleDefaultCollection,
    openMoveRequest,
    addFolder,
    deleteFolder,
    addRequestToFolder,
    toggleFolder,
    reorderCollections,
    reorderFolders,
    reorderRequests,
    setDragVisual,
  } = actions;

  const DRAG_ACTIVATE_DISTANCE = 6;
  const shouldSuppressClick = () => Date.now() < _suppressClickUntil;
  const preventSelection = () => { document.body.style.userSelect = "none"; };
  const restoreSelection = () => { document.body.style.userSelect = ""; };
  const updateDragVisual = (next: { dragType: string; dragId: string; targetType: string; targetId: string } | null) => {
    if (typeof setDragVisual === "function") setDragVisual(next);
  };
  const stopRowMouse = (e: any) => e.stopPropagation();
  const isInteractiveTarget = (target: any) => {
    if (!target || typeof target.closest !== "function") return false;
    return Boolean(target.closest("button, input, textarea, select, a, [role='button']"));
  };
  const finalizePointerReorder = () => {
    if (!_drag || !_dragOverTarget) return false;
    if (_drag.type !== _dragOverTarget.type) return false;
    if (_drag.id === _dragOverTarget.id) return false;
    if (_drag.type === "collection") reorderCollections(_drag.id, _dragOverTarget.id);
    if (_drag.type === "request") reorderRequests(_drag.id, _dragOverTarget.id);
    if (_drag.type === "folder") reorderFolders(_drag.id, _dragOverTarget.id);
    return true;
  };
  const clearPointerDrag = () => {
    _pointerDragging = false;
    _pointerCandidate = null;
    _drag = null;
    _dragOverTarget = null;
    updateDragVisual(null);
    restoreSelection();
  };
  const handlePointerMove = (evt: PointerEvent) => {
    if (!_pointerDragging && _pointerCandidate) {
      const dx = Math.abs(evt.clientX - _pointerCandidate.startX);
      const dy = Math.abs(evt.clientY - _pointerCandidate.startY);
      if (Math.max(dx, dy) >= DRAG_ACTIVATE_DISTANCE) {
        _pointerDragging = true;
        _drag = { type: _pointerCandidate.type, id: _pointerCandidate.id };
        updateDragVisual({ dragType: _pointerCandidate.type, dragId: _pointerCandidate.id, targetType: "", targetId: "" });
        preventSelection();
      }
    }
    if (!_pointerDragging || !_drag) return;
    const elAtPoint = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement | null;
    const row = elAtPoint?.closest?.("[data-am-drag-type][data-am-drag-id]") as HTMLElement | null;
    if (!row) return;
    const type = row.getAttribute("data-am-drag-type") || "";
    const id = row.getAttribute("data-am-drag-id") || "";
    if (!type || !id || type !== _drag.type) return;
    _dragOverTarget = { type, id };
    updateDragVisual({ dragType: _drag.type, dragId: _drag.id, targetType: type, targetId: id });
  };
  const handlePointerUp = () => {
    if (_pointerDragging) {
      finalizePointerReorder();
      _suppressClickUntil = Date.now() + 250;
    }
    clearPointerDrag();
  };
  const cancelPointerSession = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    clearPointerDrag();
  };
  const startPointerDrag = (type: string, id: string, e: any) => {
    if (e?.button !== 0) return;
    if (isInteractiveTarget(e?.target)) return;
    e.preventDefault();
    _pointerCandidate = { type, id, startX: e.clientX, startY: e.clientY };
    _drag = null;
    _dragOverTarget = null;
    _pointerDragging = false;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);
  const rowDeleteButtonClassName =
    "inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive";
  const strongDeleteButtonClassName =
    "inline-flex h-6 w-6 items-center justify-center rounded-md border border-destructive/25 bg-destructive/8 text-destructive transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground";
  const newRequestButtonClassName =
    "mt-0.5 inline-flex h-8 items-center justify-start rounded-md px-2.5 text-ui text-muted-foreground transition-colors hover:text-primary";

  return el(
    "div",
    { className: `am-sidebar text-ui${dragVisual?.dragId ? " am-sidebar--dragging" : ""}` },
    el(
      "div",
      { className: "am-sidebar-toolbar" },
      el(
        "div",
        { className: "flex-1" },
        el(
          Select,
          {
            value: activeEnvId,
            onChange: (value: string) => setActiveEnvId(value),
            className: "h-8 text-ui",
            containerClassName: "w-full",
          },
          el("option", { value: "none" }, t("no_environment")),
          ...environments.map((env: any) => el("option", { key: env.id, value: env.id }, env.name)),
        ),
      ),
      Button
        ? tip(
            t("manage_environments"),
            el(
              Button,
              { size: "sm", variant: "outline", onClick: () => setEnvOpen(true), className: "am-icon-btn h-8 px-2" },
              renderIcon(icons.Settings, { width: 14 }),
            ),
          )
        : null,
      Button
        ? tip(
            t("new_collection"),
            el(
              Button,
              { size: "sm", variant: "outline", onClick: createCollection, className: "am-icon-btn h-8 px-2" },
              renderIcon(icons.Plus, { width: 14 }),
            ),
          )
        : null,
    ),
    el(
      "div",
      { className: "am-sidebar-search" },
      el(
        "div",
        { className: "relative" },
        renderIcon(icons.Search, {
          width: 13,
          className: "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10 am-search-icon",
        }),
        el("input", {
          value: requestSearch,
          onChange: (e: any) => setRequestSearch(e.target.value),
          placeholder: t("search_requests"),
          className: "am-search-input am-field h-8 w-full pr-2 py-1.5 text-ui",
        }),
      ),
    ),
    el(
      "div",
      { className: "am-sidebar-scroll", style: { display: "flex", flexDirection: "column", gap: 8 } },
      collections.length === 0
        ? el("div", { className: "text-ui text-muted-foreground p-2 leading-5" }, t("collection_empty"))
        : collections.map((c: any) =>
            el(
              "div",
              { key: c.id, className: "space-y-1.5" },
              (() => {
                const isActiveCollection = activeCollection?.id === c.id;
                const isHoveredCollection = hoveredCollectionId === c.id;
                const isDraggingSource = dragVisual?.dragType === "collection" && dragVisual.dragId === c.id;
                const isDropTarget = dragVisual?.targetType === "collection" && dragVisual.targetId === c.id && !isDraggingSource;
                return el(
                  "div",
                  {
                    className: `am-draggable-row px-2.5 py-1.5 rounded-md cursor-pointer text-ui flex items-center gap-2 border transition-colors${isDraggingSource ? " am-dragging-source" : ""}${isDropTarget ? " am-drop-target" : ""}`,
                    draggable: false,
                    "data-am-drag-type": "collection",
                    "data-am-drag-id": c.id,
                    onPointerDown: (e: any) => startPointerDrag("collection", c.id, e),
                    onPointerUp: () => {
                      if (_drag?.type === "collection" && _drag.id !== c.id) reorderCollections(_drag.id, c.id);
                      cancelPointerSession();
                    },
                    onClick: () => {
                      if (shouldSuppressClick()) return;
                      cancelPointerSession();
                      selectCollection(c.id);
                    },
                    onMouseEnter: () => setHoveredCollectionId(c.id),
                    onMouseLeave: () => setHoveredCollectionId((prev: string) => (prev === c.id ? "" : prev)),
                    style: {
                      background: isActiveCollection ? "color-mix(in srgb, var(--color-muted) 72%, transparent)" : isHoveredCollection ? "color-mix(in srgb, var(--color-muted) 56%, transparent)" : "transparent",
                      borderColor: isActiveCollection ? "color-mix(in srgb, var(--color-border) 60%, transparent)" : isHoveredCollection ? "color-mix(in srgb, var(--color-border) 44%, transparent)" : "transparent",
                    },
                  },
                renderIcon(icons.Folder, { width: 13, className: "text-muted-foreground shrink-0 opacity-85" }),
                renameTarget?.kind === "collection" && renameTarget.id === c.id && Input
                  ? el(Input, {
                      autoFocus: true,
                      className: "h-7 text-ui flex-1 min-w-0",
                      value: renameDraft,
                      onChange: (e: any) => setRenameDraft(e.target.value),
                      onBlur: onRenameBlur,
                      onKeyDown: onRenameKeyDown,
                      onClick: stopRowMouse,
                      onMouseDown: stopRowMouse,
                    })
                  : el(
                      "span",
                      {
                        className: "truncate flex-1 font-medium",
                        title: t("double_click_rename"),
                        onDoubleClick: (e: any) => {
                          e.stopPropagation();
                          startRenameCollection(c.id, c.name);
                        },
                      },
                      c.name,
                    ),
                tip(
                  defaultCollectionId === c.id ? t("unset_default_collection") : t("set_default_collection"),
                  el(
                    "button",
                    {
                      type: "button",
                      onClick: (e: any) => {
                        e.stopPropagation();
                        toggleDefaultCollection(c.id);
                      },
                      className: defaultCollectionId === c.id
                        ? "inline-flex h-6 w-6 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        : "inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
                      style: {
                        opacity: isHoveredCollection || isActiveCollection || defaultCollectionId === c.id ? 1 : 0,
                        pointerEvents: isHoveredCollection || isActiveCollection || defaultCollectionId === c.id ? "auto" : "none",
                      },
                      "aria-label": defaultCollectionId === c.id ? t("unset_default_collection") : t("set_default_collection"),
                    },
                    renderIcon(icons.Bookmark, { width: 11 }),
                  ),
                ),
                tip(
                  t("run_collection"),
                  el(
                    "button",
                    {
                      type: "button",
                      onClick: (e: any) => {
                        e.stopPropagation();
                        openRunner(c.id);
                      },
                      className: "inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
                      style: {
                        opacity: isHoveredCollection || isActiveCollection ? 1 : 0,
                        pointerEvents: isHoveredCollection || isActiveCollection ? "auto" : "none",
                      },
                      "aria-label": t("run_collection"),
                    },
                    renderIcon(icons.Play, { width: 11 }),
                  ),
                ),
                tip(
                  t("delete"),
                  el(
                    "button",
                    {
                      type: "button",
                      onClick: (e: any) => {
                        e.stopPropagation();
                        deleteCollection(c.id);
                      },
                      className: `${strongDeleteButtonClassName} ml-1`,
                      style: {
                        opacity: isHoveredCollection || isActiveCollection ? 1 : 0,
                        pointerEvents: isHoveredCollection || isActiveCollection ? "auto" : "none",
                      },
                      "aria-label": t("delete"),
                    },
                    renderIcon(icons.Trash, { width: 12 }),
                  ),
                ),
              );
              })(),
              activeCollection?.id === c.id
                ? (() => {
                    const q = (requestSearch || "").trim().toLowerCase();
                    const filterRequest = (r: any) => !q || `${r.name || ""} ${r.method || ""} ${r.url || ""}`.toLowerCase().includes(q);

                    const abbrevMethod = (m: string) => ({ DELETE: "DEL", OPTIONS: "OPT", CONNECT: "CON" } as Record<string, string>)[(m || "").toUpperCase()] || m;
                    const renderRequestRow = (r: any) => {
                      const isActiveRequest = activeRequest?.id === r.id;
                      const isHoveredRequest = hoveredRequestId === r.id;
                      const isVisibleDelete = isHoveredRequest || isActiveRequest;
                      const isDraggingSource = dragVisual?.dragType === "request" && dragVisual.dragId === r.id;
                      const isDropTarget = dragVisual?.targetType === "request" && dragVisual.targetId === r.id && !isDraggingSource;
                      return el(
                        "div",
                        {
                          key: r.id,
                          "data-am-request-id": r.id,
                          className: `am-draggable-row am-sidebar-request-item px-2 py-1 rounded-md cursor-pointer text-ui flex items-center border ${recentClonedRequestId === r.id ? "am-sidebar-request-item--cloned" : ""}${isDraggingSource ? " am-dragging-source" : ""}${isDropTarget ? " am-drop-target" : ""}`,
                          draggable: false,
                          "data-am-drag-type": "request",
                          "data-am-drag-id": r.id,
                          onPointerDown: (e: any) => startPointerDrag("request", r.id, e),
                          onPointerUp: () => {
                            if (_drag?.type === "request" && _drag.id !== r.id) reorderRequests(_drag.id, r.id);
                            cancelPointerSession();
                          },
                          onClick: () => {
                            if (shouldSuppressClick()) return;
                            cancelPointerSession();
                            setActiveRequest(r);
                          },
                          onMouseEnter: () => setHoveredRequestId(r.id),
                          onMouseLeave: () => setHoveredRequestId((prev: string) => (prev === r.id ? "" : prev)),
                          style: {
                            background: isActiveRequest ? "color-mix(in srgb, var(--color-primary) 14%, transparent)" : isHoveredRequest ? "color-mix(in srgb, var(--color-muted) 60%, transparent)" : "transparent",
                            borderColor: isActiveRequest ? "color-mix(in srgb, var(--color-primary) 34%, transparent)" : isHoveredRequest ? "color-mix(in srgb, var(--color-border) 46%, transparent)" : "transparent",
                          },
                        },
                        el("span", { className: "am-method-badge am-method-badge--list", "data-method": (r.method || "").toUpperCase() }, abbrevMethod(r.method)),
                        renameTarget?.kind === "request" && renameTarget.id === r.id && Input
                          ? el(Input, { autoFocus: true, className: "h-7 text-ui flex-1 min-w-0", value: renameDraft, onChange: (e: any) => setRenameDraft(e.target.value), onBlur: onRenameBlur, onKeyDown: onRenameKeyDown, onClick: stopRowMouse, onMouseDown: stopRowMouse })
                          : tip(
                              `${r.name || ""}`,
                              el(
                                "span",
                                {
                                  className: "truncate flex-1 transition-colors",
                                  style: { color: isActiveRequest || isHoveredRequest ? "var(--color-primary)" : "color-mix(in srgb, var(--color-foreground) 95%, transparent)" },
                                  onDoubleClick: (e: any) => { e.stopPropagation(); startRenameRequest(r.id, r.name); },
                                },
                                r.name,
                              ),
                              { side: "right", className: "flex-1 min-w-0" },
                            ),
                        tip(t("move_to_collection"), el("button", { type: "button", onClick: (e: any) => { e.stopPropagation(); openMoveRequest(r.id); }, className: "inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary", style: { opacity: isVisibleDelete ? 1 : 0, pointerEvents: isVisibleDelete ? "auto" : "none" }, "aria-label": t("move_to_collection") }, renderIcon(icons.FolderInput, { width: 11 }))),
                        tip(t("delete"), el("button", { type: "button", onClick: (e: any) => { e.stopPropagation(); deleteRequest(r.id); }, className: rowDeleteButtonClassName, style: { opacity: isVisibleDelete ? 1 : 0, pointerEvents: isVisibleDelete ? "auto" : "none" }, "aria-label": t("delete") }, renderIcon(icons.Trash, { width: 11 }))),
                      );
                    };

                    const folders = activeCollection.folders || [];
                    return el(
                      "div",
                      { className: "pl-1 ml-1 space-y-1" },
                      ...(activeCollection.requests || []).filter(filterRequest).map(renderRequestRow),
                      ...folders.map((folder: any) => {
                        const isOpen = (openedFolderIds || []).includes(folder.id);
                        const folderRequests = (folder.requests || []).filter(filterRequest);
                        const folderRequestCount = q ? folderRequests.length : (folder.requests || []).length;
                        const isRenamingFolder = renameTarget?.kind === "folder" && renameTarget.id === folder.id;
                        const isDraggingSource = dragVisual?.dragType === "folder" && dragVisual.dragId === folder.id;
                        const isDropTarget = dragVisual?.targetType === "folder" && dragVisual.targetId === folder.id && !isDraggingSource;
                        return el(
                          "div",
                          { key: folder.id, className: "space-y-1" },
                          el(
                            "div",
                            {
                              className: `am-draggable-row am-folder-row flex items-center gap-1.5 px-1.5 py-1 mt-1 rounded-md cursor-pointer text-ui border transition-colors${isDraggingSource ? " am-dragging-source" : ""}${isDropTarget ? " am-drop-target" : ""}`,
                              draggable: false,
                              "data-am-drag-type": "folder",
                              "data-am-drag-id": folder.id,
                              onPointerDown: (e: any) => {
                                startPointerDrag("folder", folder.id, e);
                                e.stopPropagation();
                              },
                              onPointerUp: (e: any) => {
                                e.stopPropagation();
                                if (_drag?.type === "folder" && _drag.id !== folder.id) reorderFolders(_drag.id, folder.id);
                                cancelPointerSession();
                              },
                              onClick: () => {
                                if (shouldSuppressClick()) return;
                                cancelPointerSession();
                                toggleFolder(folder.id);
                              },
                              style: {
                                color: isOpen ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                                background: "color-mix(in srgb, var(--color-muted) 35%, transparent)",
                                borderColor: "color-mix(in srgb, var(--color-border) 40%, transparent)",
                              },
                            },
                            icons.ChevronDown || icons.ChevronRight
                              ? renderIcon(isOpen ? icons.ChevronDown : icons.ChevronRight, { width: 10, className: "shrink-0", style: { opacity: 0.55, transition: "transform 0.15s" } })
                              : el("span", { className: `am-folder-chevron${isOpen ? " am-folder-chevron--open" : ""}` }),
                            renderIcon(icons.Folder, { width: 12, className: "shrink-0", style: { opacity: isOpen ? 0.9 : 0.65 } }),
                            isRenamingFolder && Input
                              ? el(Input, { autoFocus: true, className: "h-6 text-ui flex-1 min-w-0", value: renameDraft, onChange: (e: any) => setRenameDraft(e.target.value), onBlur: onRenameBlur, onKeyDown: onRenameKeyDown, onClick: stopRowMouse, onMouseDown: stopRowMouse })
                              : el("span", { className: "truncate flex-1 font-medium text-ui", title: t("double_click_rename"), onDoubleClick: (e: any) => { e.stopPropagation(); startRenameFolder(folder.id, folder.name); } }, folder.name),
                            el("span", { className: "shrink-0 text-xs tabular-nums", style: { opacity: 0.4 } }, `${folderRequestCount}`),
                            tip(t("new_request"), el("button", { type: "button", onClick: (e: any) => { e.stopPropagation(); addRequestToFolder(folder.id); if (!isOpen) toggleFolder(folder.id); }, className: "inline-flex h-5 w-5 items-center justify-center rounded border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary", "aria-label": t("new_request") }, renderIcon(icons.Plus, { width: 10 }))),
                            tip(t("delete"), el("button", { type: "button", onClick: (e: any) => { e.stopPropagation(); deleteFolder(folder.id); }, className: "inline-flex h-5 w-5 items-center justify-center rounded border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive", "aria-label": t("delete") }, renderIcon(icons.Trash, { width: 10 }))),
                          ),
                          isOpen && folderRequests.length > 0
                            ? el("div", { className: "am-folder-children pl-3 mt-1 space-y-1" }, ...folderRequests.map(renderRequestRow))
                            : null,
                        );
                      }),
                      el(
                        "div",
                        { className: "flex items-center gap-0.5" },
                        el("button", { type: "button", onClick: addRequest, className: newRequestButtonClassName }, renderIcon(icons.Plus, { width: 13, className: "mr-1.5" }), t("new_request")),
                        el("button", { type: "button", onClick: addFolder, className: newRequestButtonClassName }, renderIcon(icons.FolderPlus || icons.Folder, { width: 13, className: "mr-1.5" }), t("new_folder")),
                      ),
                    );
                  })()
                : null,
            ),
          ),
    ),
    el(
      "div",
      { className: "am-sidebar-footer" },
      Button ? el(Button, { size: "sm", onClick: () => setImportOpen(true), className: "h-9 w-full text-ui" }, t("import_apis")) : null,
    ),
  );
}

export function renderRequestEditor(ctx: any) {
  const { el, t, Button, Input, Textarea, Select, Tabs, TabsList, TabsTrigger, TabsContent, Editor, Tooltip, icons, state, actions } = ctx;
  const tip = (
    content: string,
    child: any,
    options?: { side?: "top" | "bottom" | "left" | "right"; className?: string; multiline?: boolean },
  ) => (Tooltip ? el(Tooltip, { content, ...options }, child) : child);
  const { activeRequest, sending, collections, activeCollection, proxyActive, urlDraft, unresolvedVariables, currentTempVariableEntries } = state;
  const { updateRequest, setUrlDraft, sendRequest, cloneActiveRequest, copyAsCurl, fillMissingVariables, openTempVariableModal, removeTempVariable } = actions;
  if (!activeRequest) {
    if (!Array.isArray(collections) || collections.length === 0) {
      return el(
        "div",
        { className: "flex-1 flex items-center justify-center px-6" },
        el(
          "div",
          { className: "am-editor-empty-card am-editor-empty-card--large max-w-[660px] w-full" },
          el(
            "div",
            { className: "am-editor-empty-card__icon" },
            (icons.FolderPlus
              ? el(icons.FolderPlus, { width: 18, height: 18 })
              : icons.Folder
                ? el(icons.Folder, { width: 18, height: 18 })
                : null),
          ),
          el("div", { className: "am-editor-empty-card__title" }, t("collection_empty")),
        ),
      );
    }
    return el(
      "div",
      { className: "flex-1 flex items-center justify-center px-6" },
      el(
        "div",
        { className: "am-editor-empty-card am-editor-empty-card--large max-w-[660px] w-full" },
        el(
          "div",
          { className: "am-editor-empty-card__icon" },
          (activeCollection
            ? (icons.FileCode2
                ? el(icons.FileCode2, { width: 18, height: 18 })
                : icons.File
                  ? el(icons.File, { width: 18, height: 18 })
                  : null)
            : (icons.Folder
                ? el(icons.Folder, { width: 18, height: 18 })
                : null)),
        ),
        el("div", { className: "am-editor-empty-card__title" }, activeCollection ? t("select_request") : t("select_collection")),
      ),
    );
  }

  const postExtractRules = Array.isArray(activeRequest.postExtract) ? activeRequest.postExtract : [];
  const updatePostExtractRules = (nextRules: any[]) => updateRequest({ postExtract: nextRules });
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);
  const activeBodyType = normalizeRequestBodyType(activeRequest.bodyType);
  const requestParams: ParamItem[] = activeRequest.params || [];
  const requestAuth: AuthConfig = activeRequest.auth || { type: "none" };
  const unresolvedPreview = (unresolvedVariables?.missingKeys || []).slice(0, 3).join(", ");
  const unresolvedOverflow = Math.max((unresolvedVariables?.missingKeys || []).length - 3, 0);
  const withCount = (label: string, count: number) => count > 0 ? `${label} (${count})` : label;
  const hasOnlyTempVariables = !unresolvedVariables?.hasMissing && (currentTempVariableEntries || []).length > 0;
  const closeRequestMenu = (event?: any) => {
    const details = event?.currentTarget?.closest?.("details");
    if (details?.removeAttribute) details.removeAttribute("open");
  };
  const requestMoreActions = [
    {
      key: "export-curl",
      label: t("export_curl"),
      icon: icons.Terminal || icons.Code,
      onClick: (e?: any) => {
        closeRequestMenu(e);
        copyAsCurl();
      },
    },
  ];
  const formItems = activeBodyType === FORM_BODY_TYPE ? parseFormBodyItems(activeRequest.body) : [];
  const updateFormItems = (nextItems: Array<{ key: string; value: string; enabled: boolean }>) => {
    updateRequest({ bodyType: FORM_BODY_TYPE, body: JSON.stringify(nextItems) });
  };
  const formatJsonBody = () => {
    const raw = String(activeRequest.body || "").trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      updateRequest({ body: JSON.stringify(parsed, null, 2), bodyType: "raw" });
    } catch {}
  };
  const switchBodyType = (nextBodyType: string) => {
    const normalizedNextType = normalizeRequestBodyType(nextBodyType);
    if (normalizedNextType === "none") {
      updateRequest({ bodyType: "none", body: null });
      return;
    }
    if (normalizedNextType === FORM_BODY_TYPE) {
      updateRequest({
        bodyType: FORM_BODY_TYPE,
        body: formItems.length > 0 ? JSON.stringify(formItems) : JSON.stringify([{ key: "", value: "", enabled: true }]),
      });
      return;
    }
    updateRequest({
      bodyType: "raw",
      body: activeBodyType === "raw" ? activeRequest.body || "" : "",
    });
  };

  return el(
    "div",
    { className: "flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-visible text-ui" },
    el(
      "div",
      { className: "am-name-row gap-2" },
      el("span", { className: "w-16 shrink-0 text-ui text-muted-foreground" }, t("request_name")),
      Input ? el(Input, { className: "flex-1 h-9 text-ui", value: activeRequest.name, onChange: (e: any) => updateRequest({ name: e.target.value }) }) : null,
      Button
        ? tip(
            t("clone_request"),
            el(
              Button,
              {
                variant: "outline",
                onClick: cloneActiveRequest,
                "aria-label": t("clone_request"),
                className: "am-icon-btn h-8 w-8 p-0 shrink-0",
              },
              renderIcon(icons.FilePlus || icons.File, { width: 13 }) || "+",
            ),
          )
        : null,
      requestMoreActions.length > 1
        ? el(
            "details",
            { className: "relative shrink-0" },
            el(
              "summary",
              {
                className: "am-icon-btn flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border/50 bg-background/60 text-muted-foreground transition hover:text-foreground",
                "aria-label": t("actions"),
              },
              renderIcon(icons.MoreHorizontal, { width: 13 }) || "⋯",
            ),
            el(
              "div",
              {
                className: "absolute right-0 top-[calc(100%+6px)] z-30 min-w-[150px] overflow-hidden rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur",
                style: { borderColor: "color-mix(in srgb, var(--color-border) 55%, transparent)" },
              },
              ...requestMoreActions.map((action) =>
                el(
                  "button",
                  {
                    key: action.key,
                    type: "button",
                    className: "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-tiny text-foreground/85 transition hover:bg-muted/50",
                    onClick: action.onClick,
                  },
                  renderIcon(action.icon, { width: 13, className: "shrink-0" }) || null,
                  el("span", { className: "truncate" }, action.label),
                ),
              ),
            ),
          )
        : requestMoreActions.length === 1 && Button
          ? tip(
              requestMoreActions[0].label,
              el(
                Button,
                {
                  variant: "outline",
                  onClick: () => requestMoreActions[0].onClick(),
                  "aria-label": requestMoreActions[0].label,
                  className: "am-icon-btn h-8 w-8 p-0 shrink-0",
                },
                renderIcon(requestMoreActions[0].icon, { width: 13 }) || null,
              ),
            )
          : null,
    ),
    el(
      "div",
      { className: "am-command-bar relative z-20" },
      el(
        "div",
        { className: "flex gap-2 items-center min-w-0" },
        el(
          Select,
          {
            value: activeRequest.method,
            onChange: (value: string) => updateRequest({ method: value }),
            className: "h-9 text-ui",
            containerClassName: "w-[96px] shrink-0",
          },
          ...["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((m) => el("option", { key: m, value: m }, m)),
        ),
        Input
          ? el(Input, {
              className: "flex-1 min-w-0 h-9 text-ui",
              value: urlDraft,
              onChange: (e: any) => setUrlDraft(e.target.value),
              onBlur: () => {
                if (urlDraft !== activeRequest.url) void updateRequest({ url: urlDraft });
              },
              onKeyDown: (e: any) => {
                if (e.key === "Enter" && urlDraft !== activeRequest.url) {
                  e.preventDefault();
                  void updateRequest({ url: urlDraft });
                }
              },
              placeholder: t("url_placeholder"),
            })
          : null,
        Button
          ? tip(
              !proxyActive ? t("send_disabled_proxy_inactive") : t("send"),
              el(
                Button,
                {
                  onClick: sendRequest,
                  disabled: sending || !proxyActive,
                  className: "h-9 w-10 p-0 shrink-0 font-semibold",
                  "aria-label": t("send"),
                },
              sending ? "..." : renderIcon(icons.Send, { width: 15 }) || t("send"),
              ),
              { side: "top" },
            )
          : null,
      ),
    ),
    (unresolvedVariables?.hasMissing || (currentTempVariableEntries || []).length > 0)
      ? el(
          "div",
          { className: `am-warning-bar${hasOnlyTempVariables ? " am-warning-bar--info" : ""}` },
          el(
            "div",
            { className: `am-warning-bar__icon${hasOnlyTempVariables ? " am-warning-bar__icon--info" : ""}` },
            renderIcon(hasOnlyTempVariables ? (icons.Info || icons.CircleAlert || icons.AlertCircle) : (icons.AlertTriangle || icons.AlertCircle), { width: 14, height: 14 }) || "!",
          ),
          el(
            "div",
            { className: "min-w-0 flex-1 space-y-1" },
            el(
              "div",
              { className: "am-warning-bar__title" },
              unresolvedVariables?.hasMissing
                ? t("unresolved_variables_summary", { count: unresolvedVariables.missingKeys.length })
                : t("temp_variables_summary"),
            ),
            el(
              "div",
              { className: "am-warning-bar__meta" },
              unresolvedVariables?.hasMissing
                ? `${unresolvedPreview}${unresolvedOverflow > 0 ? ` +${unresolvedOverflow}` : ""}`
                : t("temp_variables_ready"),
            ),
            (currentTempVariableEntries || []).length > 0
              ? el(
                  "div",
                  { className: "am-warning-bar__chips" },
                  ...(currentTempVariableEntries || []).map(([key, value]: [string, string]) =>
                    el(
                      "span",
                      { key, className: "am-warning-chip" },
                      el("span", { className: "truncate max-w-[160px]" }, `${key}${value ? `=${value}` : ""}`),
                      el(
                        "button",
                        {
                          type: "button",
                          className: "am-warning-chip__remove",
                          onClick: () => removeTempVariable(key),
                          "aria-label": t("delete"),
                        },
                        "×",
                      ),
                    ),
                  ),
                )
              : null,
          ),
          el(
            "div",
            { className: "flex shrink-0 gap-2" },
            Button
              ? el(
                  Button,
                  {
                    variant: "outline",
                    size: "sm",
                    className: "h-8 shrink-0",
                    onClick: fillMissingVariables,
                    disabled: !unresolvedVariables?.hasMissing,
                  },
                  t("environment_variables_action"),
                )
              : null,
            Button
              ? el(
                  Button,
                  {
                    variant: "outline",
                    size: "sm",
                    className: "h-8 shrink-0",
                    onClick: openTempVariableModal,
                  },
                  t("temp_variable_action"),
                )
              : null,
          ),
        )
      : null,
    Tabs
      ? el(
          Tabs,
          { defaultValue: "params", className: "am-tabs-card" },
          el(
            TabsList,
            { className: "h-8 w-fit" },
            el(TabsTrigger, { value: "params", className: "h-7 px-3 text-ui" }, withCount(t("params"), unresolvedVariables?.sectionCounts?.params || 0)),
            el(TabsTrigger, { value: "headers", className: "h-7 px-3 text-ui" }, withCount(t("headers"), unresolvedVariables?.sectionCounts?.headers || 0)),
            el(TabsTrigger, { value: "body", className: "h-7 px-3 text-ui" }, withCount(t("body"), unresolvedVariables?.sectionCounts?.body || 0)),
            el(TabsTrigger, { value: "auth", className: "h-7 px-3 text-ui" }, withCount(t("auth"), unresolvedVariables?.sectionCounts?.auth || 0)),
            el(TabsTrigger, { value: "extract", className: "h-7 px-3 text-ui" }, t("extract")),
          ),
          el(
            TabsContent,
            { value: "params", className: "max-h-[248px] min-h-[168px] space-y-2 overflow-auto pr-1" },
            el(
              "div",
              { className: "am-kv-title-row" },
              el("span", { className: "am-kv-title-label" }, t("params")),
              el(
                "button",
                {
                  type: "button",
                  className: "inline-flex items-center gap-1 px-2 h-7 rounded-md text-tiny font-medium text-muted-foreground hover:text-primary transition-colors",
                  onClick: () =>
                    updateRequest({
                      params: [...requestParams, { key: "", value: "", enabled: true }],
                    }),
                },
                renderIcon(icons.Plus, { width: 13 }),
                t("add_param"),
              ),
            ),
            el(
              "div",
              { className: "space-y-1.5" },
              ...requestParams.map((p: ParamItem, i: number) =>
                el(
                  "div",
                  { key: i, className: "am-kv-row" },
                  el(
                    "button",
                    {
                      type: "button",
                      className: `am-kv-toggle ${p.enabled !== false ? "am-kv-toggle--on" : "am-kv-toggle--off"}`,
                      onClick: () =>
                        updateRequest({
                          params: requestParams.map((x: ParamItem, idx: number) => (idx === i ? { ...x, enabled: x.enabled === false } : x)),
                        }),
                    },
                    renderIcon(p.enabled !== false ? icons.CheckCircle : icons.Circle, { width: 16, height: 16 }),
                  ),
                  el(
                    "div",
                    { className: `am-kv-input-group${p.enabled !== false ? "" : " am-kv-input-group--disabled"}` },
                    el("input", {
                      type: "text",
                      value: p.key,
                      placeholder: t("key"),
                      onChange: (e: any) =>
                        updateRequest({ params: requestParams.map((x: ParamItem, idx: number) => (idx === i ? { ...x, key: e.target.value } : x)) }),
                    }),
                    el("input", {
                      type: "text",
                      value: p.value,
                      placeholder: t("value"),
                      onChange: (e: any) =>
                        updateRequest({ params: requestParams.map((x: ParamItem, idx: number) => (idx === i ? { ...x, value: e.target.value } : x)) }),
                    }),
                  ),
                  el(
                    "button",
                    {
                      type: "button",
                      className: "am-kv-delete",
                      onClick: () =>
                        updateRequest({ params: requestParams.filter((_: ParamItem, idx: number) => idx !== i) }),
                      "aria-label": t("delete"),
                    },
                    renderIcon(icons.Trash, { width: 14 }) || "×",
                  ),
                ),
              ),
              requestParams.length === 0
                ? el("div", { className: "am-empty-state text-tiny px-2.5 py-3 text-center" }, t("params_empty"))
                : null,
            ),
          ),
          el(
            TabsContent,
            { value: "headers", className: "max-h-[248px] min-h-[168px] space-y-2 overflow-auto pr-1" },
            el(
              "div",
              { className: "am-kv-title-row" },
              el("span", { className: "am-kv-title-label" }, t("headers")),
              el(
                "button",
                {
                  type: "button",
                  className: "inline-flex items-center gap-1 px-2 h-7 rounded-md text-tiny font-medium text-muted-foreground hover:text-primary transition-colors",
                  onClick: () =>
                    updateRequest({
                      headers: [...(activeRequest.headers || []), { key: "", value: "", enabled: true }],
                    }),
                },
                renderIcon(icons.Plus, { width: 13 }),
                t("add_header"),
              ),
            ),
            el(
              "div",
              { className: "space-y-1.5" },
              ...(activeRequest.headers || []).map((h: any, i: number) =>
                el(
                  "div",
                  { key: i, className: "am-kv-row" },
                  el(
                    "button",
                    {
                      type: "button",
                      className: `am-kv-toggle ${h.enabled ? "am-kv-toggle--on" : "am-kv-toggle--off"}`,
                      onClick: () =>
                        updateRequest({
                          headers: activeRequest.headers.map((x: any, idx: number) => (idx === i ? { ...x, enabled: !x.enabled } : x)),
                        }),
                    },
                    renderIcon(h.enabled ? icons.CheckCircle : icons.Circle, { width: 16, height: 16 }),
                  ),
                  el(
                    "div",
                    { className: `am-kv-input-group${h.enabled ? "" : " am-kv-input-group--disabled"}` },
                    el("input", {
                      type: "text",
                      value: h.key,
                      placeholder: t("key"),
                      onChange: (e: any) =>
                        updateRequest({ headers: activeRequest.headers.map((x: any, idx: number) => (idx === i ? { ...x, key: e.target.value } : x)) }),
                    }),
                    el("input", {
                      type: "text",
                      value: h.value,
                      placeholder: t("value"),
                      onChange: (e: any) =>
                        updateRequest({ headers: activeRequest.headers.map((x: any, idx: number) => (idx === i ? { ...x, value: e.target.value } : x)) }),
                    }),
                  ),
                  el(
                    "button",
                    {
                      type: "button",
                      className: "am-kv-delete",
                      onClick: () =>
                        updateRequest({
                          headers: activeRequest.headers.filter((_: any, idx: number) => idx !== i),
                        }),
                      title: t("delete"),
                      "aria-label": t("delete"),
                    },
                    renderIcon(icons.Trash, { width: 14 }) || "×",
                  ),
                ),
              ),
              (activeRequest.headers || []).length === 0
                ? el("div", { className: "am-empty-state text-tiny px-2.5 py-3 text-center" }, t("headers_empty", { defaultValue: t("add_header") }))
                : null,
            ),
          ),
          el(
            TabsContent,
            { value: "body", className: "am-tabpanel--body min-h-[168px] space-y-2 overflow-hidden flex flex-col" },
            el(
              "div",
              { className: "flex items-center justify-end gap-2" },
              activeBodyType === "raw" && Button
                ? el(
                    Button,
                    {
                      variant: "outline",
                      size: "sm",
                      className: "h-8 px-2",
                      onClick: formatJsonBody,
                      "aria-label": t("format_json"),
                    },
                    renderIcon(icons.Code, { width: 13 }) || "{}",
                    el("span", { className: "ml-1" }, t("format_json")),
                  )
                : null,
              el(
                Select,
                {
                  value: activeBodyType,
                  onChange: switchBodyType,
                  className: "h-8 text-ui",
                  containerClassName: "w-36 shrink-0",
                },
                el("option", { value: "none" }, "None"),
                el("option", { value: FORM_BODY_TYPE }, "Form-data"),
                el("option", { value: "raw" }, "JSON"),
              ),
            ),
            activeBodyType === "none"
              ? el("div", { className: "am-empty-state h-44 flex items-center justify-center text-sm" }, t("body_none"))
              : activeBodyType === FORM_BODY_TYPE
                ? el(
                    "div",
                    { className: "max-h-[248px] min-h-[168px] space-y-2 overflow-auto pr-1" },
                    el(
                      "div",
                      { className: "am-kv-title-row" },
                      el("span", { className: "am-kv-title-label" }, "Form Data"),
                      el(
                        "button",
                        {
                          type: "button",
                          className: "inline-flex items-center gap-1 px-2 h-7 rounded-md text-tiny font-medium text-muted-foreground hover:text-primary transition-colors",
                          onClick: () => updateFormItems([...formItems, { key: "", value: "", enabled: true }]),
                        },
                        renderIcon(icons.Plus, { width: 13 }),
                        t("add_field"),
                      ),
                    ),
                    el(
                      "div",
                      { className: "space-y-1.5" },
                      ...formItems.map((item: any, idx: number) => {
                        const enabled = item.enabled !== false;
                        return el(
                          "div",
                          { key: idx, className: "am-kv-row" },
                          el(
                            "button",
                            {
                              type: "button",
                              className: `am-kv-toggle ${enabled ? "am-kv-toggle--on" : "am-kv-toggle--off"}`,
                              onClick: () => {
                                const next = [...formItems];
                                next[idx] = { ...next[idx], enabled: !enabled };
                                updateFormItems(next);
                              },
                            },
                            renderIcon(enabled ? icons.CheckCircle : icons.Circle, { width: 16, height: 16 }),
                          ),
                          el(
                            "div",
                            { className: `am-kv-input-group${enabled ? "" : " am-kv-input-group--disabled"}` },
                            el("input", {
                              type: "text",
                              value: item.key || "",
                              placeholder: t("key"),
                              onChange: (e: any) => {
                                const next = [...formItems];
                                next[idx] = { ...next[idx], key: e.target.value };
                                updateFormItems(next);
                              },
                            }),
                            el("input", {
                              type: "text",
                              value: item.value || "",
                              placeholder: t("value"),
                              onChange: (e: any) => {
                                const next = [...formItems];
                                next[idx] = { ...next[idx], value: e.target.value };
                                updateFormItems(next);
                              },
                            }),
                          ),
                          el(
                            "button",
                            {
                              type: "button",
                              className: "am-kv-delete",
                              onClick: () => updateFormItems(formItems.filter((_: any, i: number) => i !== idx)),
                              title: t("delete"),
                              "aria-label": t("delete"),
                            },
                            renderIcon(icons.Trash, { width: 14 }) || "×",
                          ),
                        );
                      }),
                      formItems.length === 0
                        ? el("div", { className: "am-empty-state text-tiny px-2.5 py-3 text-center" }, t("body_form"))
                        : null,
                    ),
                  )
                : Editor
                  ? el(
                      "div",
                      { className: "flex-1 min-h-0 overflow-hidden rounded-lg border border-border/40" },
                      el(Editor, {
                        value: activeRequest.body || "",
                        onChange: (v: string) => updateRequest({ body: v, bodyType: "raw" }),
                        language: "json",
                        height: "100%",
                      }),
                    )
                  : Textarea
                    ? el(Textarea, {
                        value: activeRequest.body || "",
                        onChange: (e: any) => updateRequest({ body: e.target.value, bodyType: "raw" }),
                        className: "h-44",
                      })
                    : null,
          ),
          el(
            TabsContent,
            { value: "auth", className: "min-h-[168px] space-y-3 p-1" },
            (() => {
              const auth = requestAuth;
              const setAuth = (patch: Partial<AuthConfig>) => updateRequest({ auth: { ...auth, ...patch } });
              const authType = auth.type || "none";
              return el(
                "div",
                { className: "flex flex-col gap-3" },
                el(
                  "div",
                  { className: "flex items-center gap-3" },
                  el("span", { className: "am-kv-title-label w-16 shrink-0" }, t("auth_type")),
                  Select
                    ? el(
                        Select,
                        { value: authType, onChange: (v: string) => setAuth({ type: v as AuthConfig["type"] }), className: "h-8 text-ui", containerClassName: "w-48 shrink-0" },
                        el("option", { value: "none" }, t("auth_none")),
                        el("option", { value: "bearer" }, t("auth_bearer")),
                        el("option", { value: "basic" }, t("auth_basic")),
                        el("option", { value: "apikey" }, t("auth_apikey")),
                      )
                    : null,
                ),
                authType === "bearer"
                  ? el(
                      "div",
                      { className: "flex flex-col gap-1.5" },
                      el("label", { className: "am-kv-title-label" }, t("auth_token")),
                      Input
                        ? el(Input, { value: auth.bearer || "", placeholder: "{{token}}", onChange: (e: any) => setAuth({ bearer: e.target.value }) })
                        : null,
                      el("p", { className: "text-tiny text-muted-foreground" }, t("auth_bearer_hint")),
                    )
                  : authType === "basic"
                    ? el(
                        "div",
                        { className: "flex gap-2" },
                        el(
                          "div",
                          { className: "flex flex-col gap-1.5 flex-1" },
                          el("label", { className: "am-kv-title-label" }, t("auth_username")),
                          Input ? el(Input, { value: auth.basicUser || "", placeholder: t("auth_username"), onChange: (e: any) => setAuth({ basicUser: e.target.value }) }) : null,
                        ),
                        el(
                          "div",
                          { className: "flex flex-col gap-1.5 flex-1" },
                          el("label", { className: "am-kv-title-label" }, t("auth_password")),
                          Input ? el(Input, { type: "password", value: auth.basicPass || "", placeholder: t("auth_password"), onChange: (e: any) => setAuth({ basicPass: e.target.value }) }) : null,
                        ),
                      )
                    : authType === "apikey"
                      ? el(
                          "div",
                          { className: "flex flex-col gap-3" },
                          el(
                            "div",
                            { className: "flex gap-2" },
                            el(
                              "div",
                              { className: "flex flex-col gap-1.5 flex-1" },
                              el("label", { className: "am-kv-title-label" }, t("auth_key_name")),
                              Input ? el(Input, { value: auth.apikeyKey || "", placeholder: "X-API-Key", onChange: (e: any) => setAuth({ apikeyKey: e.target.value }) }) : null,
                            ),
                            el(
                              "div",
                              { className: "flex flex-col gap-1.5 flex-1" },
                              el("label", { className: "am-kv-title-label" }, t("auth_key_value")),
                              Input ? el(Input, { value: auth.apikeyValue || "", placeholder: "{{apiKey}}", onChange: (e: any) => setAuth({ apikeyValue: e.target.value }) }) : null,
                            ),
                          ),
                          el(
                            "div",
                            { className: "flex items-center gap-3" },
                            el("span", { className: "am-kv-title-label w-16 shrink-0" }, t("auth_location")),
                            Select
                              ? el(
                                  Select,
                                  { value: auth.apikeyLocation || "header", onChange: (v: string) => setAuth({ apikeyLocation: v as AuthConfig["apikeyLocation"] }), className: "h-8 text-ui", containerClassName: "w-36 shrink-0" },
                                  el("option", { value: "header" }, t("auth_location_header")),
                                  el("option", { value: "query" }, t("auth_location_query")),
                                )
                              : null,
                          ),
                        )
                      : el("div", { className: "am-empty-state text-tiny px-2.5 py-3 text-center" }, t("auth_none_hint")),
              );
            })(),
          ),
          el(
            TabsContent,
            { value: "extract", className: "max-h-[248px] min-h-[168px] space-y-2 overflow-auto pr-1" },
            el(
              "div",
              { className: "am-kv-title-row" },
              el("span", { className: "am-kv-title-label" }, t("extract")),
              el(
                "button",
                {
                  type: "button",
                  className: "inline-flex items-center gap-1 px-2 h-7 rounded-md text-tiny font-medium text-muted-foreground hover:text-primary transition-colors",
                  onClick: () =>
                    updatePostExtractRules([
                      ...postExtractRules,
                      { variable: "", from: "body", path: "$.data.token", header: "" },
                    ]),
                },
                renderIcon(icons.Plus, { width: 13 }),
                t("add_extract_rule"),
              ),
            ),
            postExtractRules.length === 0
              ? el("div", { className: "am-empty-state text-tiny px-2.5 py-3 text-center" }, t("extract_empty"))
              : null,
            ...postExtractRules.map((rule: any, idx: number) =>
              el(
                "div",
                { key: idx, className: "am-kv-row" },
                Input
                  ? el(Input, {
                      className: "h-8 text-ui w-40 shrink-0",
                      value: rule.variable || "",
                      placeholder: t("extract_variable"),
                      onChange: (e: any) =>
                        updatePostExtractRules(postExtractRules.map((x: any, i: number) => (i === idx ? { ...x, variable: e.target.value } : x))),
                    })
                  : null,
                el(
                  Select,
                  {
                    value: rule.from || "body",
                    onChange: (value: string) =>
                      updatePostExtractRules(
                        postExtractRules.map((x: any, i: number) =>
                          i === idx ? { ...x, from: value, path: value === "body" ? x.path || "$." : "", header: value === "header" ? x.header || "" : "" } : x,
                        ),
                      ),
                    className: "h-8 text-ui",
                    containerClassName: "w-32 shrink-0",
                  },
                  el("option", { value: "body" }, t("extract_from_body")),
                  el("option", { value: "header" }, t("extract_from_header")),
                  el("option", { value: "status" }, t("extract_from_status")),
                ),
                rule.from === "header"
                  ? Input
                    ? el(Input, {
                        className: "h-8 text-ui flex-1 min-w-0",
                        value: rule.header || "",
                        placeholder: t("extract_header_name"),
                        onChange: (e: any) =>
                          updatePostExtractRules(postExtractRules.map((x: any, i: number) => (i === idx ? { ...x, header: e.target.value } : x))),
                      })
                    : null
                  : rule.from === "status"
                    ? el("div", { className: "flex h-8 min-w-0 flex-1 items-center rounded-md border border-dashed border-border/60 px-2 text-xs text-muted-foreground" }, t("extract_status_hint"))
                    : Input
                      ? el(Input, {
                          className: "h-8 text-ui flex-1 min-w-0",
                          value: rule.path || "",
                          placeholder: t("extract_json_path"),
                          onChange: (e: any) =>
                            updatePostExtractRules(postExtractRules.map((x: any, i: number) => (i === idx ? { ...x, path: e.target.value } : x))),
                        })
                      : null,
                el(
                  "button",
                  {
                    type: "button",
                    className: "am-kv-delete",
                    onClick: () => updatePostExtractRules(postExtractRules.filter((_: any, i: number) => i !== idx)),
                    title: t("delete"),
                    "aria-label": t("delete"),
                  },
                  renderIcon(icons.Trash, { width: 14 }) || "×",
                ),
              ),
            ),
          ),
        )
      : null,
  );
}

export function renderResponsePanel(ctx: any) {
  const { el, t, Button, Select, Editor, Tooltip, icons, state, actions } = ctx;
  const MAX_FORMATTABLE_RESPONSE_SIZE = 300 * 1024;
  const tip = (content: string, child: any) => (Tooltip ? el(Tooltip, { content }, child) : child);
  const { response, activeRequest, requestHistory, historySelection, responseTab } = state;
  const { openMockModal, setHistorySelection, setResponseTab, applyHistoryToActiveRequest, removeRequestHistory, clearActiveRequestHistory } = actions;
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);
  const scopedHistory = activeRequest?.id ? (requestHistory || []).filter((item: any) => item.sourceRequestId === activeRequest.id) : [];
  const selectedHistory = scopedHistory.some((item: any) => item.id === historySelection) ? historySelection : "";
  const selectedHistoryItem = selectedHistory ? scopedHistory.find((item: any) => item.id === selectedHistory) : null;
  const previewResponse = selectedHistoryItem
    ? {
        status: selectedHistoryItem.result.status,
        time: selectedHistoryItem.result.time,
        total_bytes: selectedHistoryItem.result.totalBytes,
        body: selectedHistoryItem.result.body ?? "",
        headers: selectedHistoryItem.result.headers ?? {},
      }
    : null;
  const displayResponse = previewResponse || response;
  const getHeaderValue = (headers: Record<string, any> | undefined, headerName: string) => {
    const target = headerName.toLowerCase();
    const matchedKey = Object.keys(headers || {}).find((key) => key.toLowerCase() === target);
    return matchedKey ? String(headers?.[matchedKey] || "") : "";
  };
  const formatResponseBody = (body: any, headers: Record<string, any> | undefined) => {
    const raw = String(body || "");
    if (!raw.trim()) return raw;
    if (raw.length > MAX_FORMATTABLE_RESPONSE_SIZE) return raw;
    const contentType = getHeaderValue(headers, "content-type");
    const looksJson = contentType.includes("json") || /^[\[{]/.test(raw.trim());
    if (!looksJson) return raw;
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };
  const displayBody = formatResponseBody(displayResponse?.body, displayResponse?.headers);
  const displayLanguage = getHeaderValue(displayResponse?.headers, "content-type").includes("json") ? "json" : "text";
  const formatHistoryLabel = (item: any) => {
    const status = Number(item?.result?.status || 0);
    const time = Number(item?.result?.time || 0);
    const createdAt = Number(item?.createdAt || 0);
    const stamp = createdAt > 0 ? new Date(createdAt).toLocaleTimeString() : "";
    return `${status || "-"} · ${time}ms · ${stamp}`.trim();
  };
  return el(
    "div",
    { className: "am-response-card min-h-[240px] h-[38%] mx-4 mb-4 text-ui" },
    el(
      "div",
      { className: "flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2", style: { borderColor: "color-mix(in srgb, var(--color-border) 22%, transparent)", background: "color-mix(in srgb, var(--color-muted) 10%, transparent)" } },
      el(
        "div",
        { className: "text-ui flex gap-2 items-center flex-wrap min-w-0" },
        el("span", { className: "font-semibold text-foreground shrink-0" }, t("response")),
        displayResponse
          ? el(
              "span",
              {
                className: `am-status-badge ${Number(displayResponse.status) >= 200 && Number(displayResponse.status) < 300 ? "am-status-badge--ok" : Number(displayResponse.status) >= 400 ? "am-status-badge--err" : "am-status-badge--info"}`,
              },
              `${t("status")}: ${displayResponse.status}`,
            )
          : null,
        displayResponse ? el("span", { className: "am-meta-tag" }, `${t("time")}: ${displayResponse.time}ms`) : null,
        displayResponse ? el("span", { className: "am-meta-tag" }, `${t("size")}: ${displayResponse.total_bytes || 0}B`) : null,
      ),
      el(
        "div",
        { className: "flex items-center gap-2 shrink-0" },
        displayResponse
          ? tip(
              t("copy_response_body"),
              el(
                "button",
                {
                  type: "button",
                  className: "am-icon-btn h-8 w-8 p-0 shrink-0",
                  onClick: () => void navigator.clipboard?.writeText(displayBody || ""),
                  "aria-label": t("copy_response_body"),
                },
                renderIcon(icons.Copy, { width: 13 }) || "⧉",
              ),
            )
          : null,
        displayResponse
          ? el(
              "div",
              { className: "flex rounded-md overflow-hidden border", style: { borderColor: "color-mix(in srgb, var(--color-border) 50%, transparent)" } },
              el(
                "button",
                {
                  type: "button",
                  onClick: () => setResponseTab("body"),
                  className: "px-2.5 h-7 text-tiny font-medium transition-colors",
                  style: {
                    background: (responseTab || "body") === "body" ? "color-mix(in srgb, var(--color-muted) 60%, transparent)" : "transparent",
                    color: (responseTab || "body") === "body" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                  },
                },
                t("response_body"),
              ),
              el(
                "button",
                {
                  type: "button",
                  onClick: () => setResponseTab("headers"),
                  className: "px-2.5 h-7 text-tiny font-medium border-l transition-colors",
                  style: {
                    borderColor: "color-mix(in srgb, var(--color-border) 50%, transparent)",
                    background: responseTab === "headers" ? "color-mix(in srgb, var(--color-muted) 60%, transparent)" : "transparent",
                    color: responseTab === "headers" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                  },
                },
                t("response_headers"),
              ),
            )
          : null,
        !previewResponse && response && Button ? el(Button, { size: "sm", variant: "outline", className: "shrink-0", onClick: openMockModal }, t("create_mock")) : null,
      ),
    ),
    el(
      "div",
      { className: "flex shrink-0 items-center gap-2 px-4 py-2", style: { borderBottom: "1px solid color-mix(in srgb, var(--color-border) 18%, transparent)", background: "color-mix(in srgb, var(--color-muted) 5%, transparent)" } },
      renderIcon(icons.History, { width: 14 }) || null,
      Select
        ? el(
            Select,
            {
              value: selectedHistory,
              onChange: (value: string) => setHistorySelection(value),
              className: "h-8 text-ui",
              containerClassName: "w-[220px] shrink-0",
            },
            el("option", { value: "" }, `${t("request_history")} (${scopedHistory.length})`),
            ...scopedHistory.map((item: any) => el("option", { key: item.id, value: item.id }, formatHistoryLabel(item))),
          )
        : null,
      Button
        ? tip(
            t("apply_history"),
            el(
              Button,
              {
                variant: "outline",
                className: "am-icon-btn h-8 w-8 p-0 shrink-0",
                disabled: !selectedHistory,
                onClick: () => applyHistoryToActiveRequest(selectedHistory),
                "aria-label": t("apply_history"),
              },
              renderIcon(icons.Check, { width: 13 }) || "✓",
            ),
          )
        : null,
      Button
        ? tip(
            t("delete_history_item"),
            el(
              Button,
              {
                variant: "ghost",
                className: "am-icon-btn am-danger-icon-btn h-8 w-8 p-0 shrink-0",
                disabled: !selectedHistory,
                onClick: () => removeRequestHistory(selectedHistory),
                "aria-label": t("delete_history_item"),
              },
              renderIcon(icons.Trash, { width: 13 }) || "⌫",
            ),
          )
        : null,
      Button
        ? tip(
            t("clear_history"),
            el(
              Button,
              {
                variant: "ghost",
                className: "am-icon-btn am-danger-icon-btn am-danger-icon-btn--strong h-8 w-8 p-0 shrink-0",
                disabled: scopedHistory.length === 0,
                onClick: clearActiveRequestHistory,
                "aria-label": t("clear_history"),
              },
              renderIcon(icons.X, { width: 13 }) || "×",
            ),
          )
        : null,
    ),
    previewResponse
      ? el(
          "div",
          { className: "am-history-preview-banner shrink-0" },
          renderIcon(icons.History, { width: 12, className: "shrink-0" }) || null,
          el("span", null, t("history_preview_hint")),
          el("span", { className: "am-history-preview-banner__sep" }, "·"),
          el(
            "button",
            {
              className: "am-history-preview-banner__action",
              onClick: () => applyHistoryToActiveRequest(selectedHistory),
            },
            t("apply_history"),
          ),
        )
      : null,
    el(
      "div",
      { className: "flex-1 min-h-0 overflow-hidden flex flex-col" },
      !displayResponse
        ? el("div", { className: "am-response-body am-empty-state text-ui flex items-center justify-center" }, t("response_empty"))
        : responseTab === "headers"
          ? el(
              "div",
              { className: "am-response-body overflow-auto" },
              Object.keys(displayResponse.headers || {}).length === 0
                ? el("div", { className: "text-tiny text-muted-foreground py-4 text-center" }, t("response_headers_empty"))
                : el(
                    "table",
                    { className: "w-full text-tiny border-collapse" },
                    el(
                      "tbody",
                      null,
                      ...Object.entries(displayResponse.headers || {}).map(([k, v]: [string, any]) =>
                        el(
                          "tr",
                          { key: k, className: "border-b", style: { borderColor: "color-mix(in srgb, var(--color-border) 25%, transparent)" } },
                          el("td", { className: "py-1.5 pr-4 font-medium text-muted-foreground whitespace-nowrap align-top w-[40%]" }, k),
                          el("td", { className: "py-1.5 font-mono text-foreground/90 break-all" }, String(v)),
                        ),
                      ),
                    ),
                  ),
            )
          : Editor
            ? el(
                "div",
                { className: "am-response-body am-response-body--editor flex-1 min-h-0" },
                el(Editor, {
                  value: displayBody,
                  language: displayLanguage,
                  readOnly: true,
                  height: "100%",
                }),
              )
            : el("pre", { className: "am-response-body text-foreground/90 text-ui whitespace-pre-wrap" }, displayBody),
    ),
  );
}
