/* eslint-disable @typescript-eslint/no-explicit-any */
import { PRESET_ENV_VARIABLES } from "../utils";
import type { RunnerResult } from "../types";

export function renderImportModal(ctx: any) {
  const { el, t, Button, Input, Textarea, Select, Editor, icons, state, actions } = ctx;
  const { importOpen, importFormat, importMode, importUrl, importText, importTargetCollectionId, collections } = state;
  const { setImportOpen, setImportFormat, setImportMode, setImportUrl, setImportText, setImportTargetCollectionId, importCollection } = actions;
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);
  if (!importOpen) return null;

  const isOpenApi = importFormat === "openapi";

  return el(
    "div",
    { className: "am-modal-overlay" },
    el("div", { className: "am-modal-backdrop", onClick: () => setImportOpen(false) }),
    el(
      "div",
      { className: "am-modal-shell am-modal-shell--lg" },
      el(
        "div",
        { className: "am-modal-header" },
        el("h3", null, t("import_title")),
        el("button", { type: "button", className: "am-modal-close", onClick: () => setImportOpen(false), "aria-label": t("close") }, renderIcon(icons?.X, { width: 15 }) || "×"),
      ),
      el(
        "div",
        { className: "am-modal-body space-y-3 text-ui" },
        // Format selector
        el(
          "div",
          { className: "flex gap-2" },
          Button ? el(Button, { variant: isOpenApi ? "default" : "outline", onClick: () => setImportFormat("openapi"), className: "h-8" }, t("import_format_openapi")) : null,
          Button ? el(Button, { variant: importFormat === "postman" ? "default" : "outline", onClick: () => setImportFormat("postman"), className: "h-8" }, t("import_format_postman")) : null,
        ),
        // URL / paste mode toggle (both formats support URL and paste)
        el(
          "div",
          { className: "flex gap-2" },
          Button ? el(Button, { variant: importMode === "url" ? "default" : "outline", onClick: () => setImportMode("url"), className: "h-8" }, t("import_swagger_url")) : null,
          Button ? el(Button, { variant: importMode === "paste" ? "default" : "outline", onClick: () => setImportMode("paste"), className: "h-8" }, t("import_swagger_paste")) : null,
        ),
        // Input area
        importMode === "url"
          ? el("input", {
              value: importUrl,
              onChange: (e: any) => setImportUrl(e.target.value),
              placeholder: isOpenApi ? "https://example.com/openapi.json" : "https://example.com/collection.json",
              className: "am-field text-ui",
            })
          : el(
              "div",
              { style: { height: 200, flexShrink: 0, overflow: "hidden" } },
              Editor
                ? el(Editor, { value: importText, onChange: setImportText, language: "json", height: "200px" })
                : el("textarea", { value: importText, onChange: (e: any) => setImportText(e.target.value), className: "am-field text-ui h-full py-2.5" }),
            ),
      ),
      // Target collection — outside scrollable body so dropdown isn't clipped
      el(
        "div",
        { className: "am-modal-section space-y-1" },
        el("label", { className: "text-ui text-muted-foreground font-medium" }, t("save_flow_collection")),
        Select
          ? el(
              Select,
              {
                value: importTargetCollectionId,
                onChange: (value: string) => setImportTargetCollectionId(value),
                className: "text-ui",
                containerClassName: "w-full",
              },
              el("option", { value: "" }, t("import_select_collection")),
              ...collections.map((c: any) => el("option", { key: c.id, value: c.id }, c.name)),
            )
          : el(
              "select",
              {
                value: importTargetCollectionId,
                onChange: (e: any) => setImportTargetCollectionId(e.target.value),
                className: "am-field text-ui",
              },
              el("option", { value: "" }, t("import_select_collection")),
              ...collections.map((c: any) => el("option", { key: c.id, value: c.id }, c.name)),
            ),
      ),
      el(
        "div",
        { className: "am-modal-footer" },
        Button ? el(Button, { variant: "outline", onClick: () => setImportOpen(false) }, t("cancel")) : null,
        Button ? el(Button, { onClick: importCollection }, t("import_apis")) : null,
      ),
    ),
  );
}

export function renderFlowModal(ctx: any) {
  const { el, t, Button, Input, Select, icons, state, actions } = ctx;
  const { flowSaveOpen, flowRequestName, flowTargetCollectionId, collections } = state;
  const { setFlowSaveOpen, setFlowRequestName, setFlowTargetCollectionId, saveFlowToCollection } = actions;
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);
  if (!flowSaveOpen) return null;
  return el(
    "div",
    { className: "am-modal-overlay" },
    el("div", { className: "am-modal-backdrop", onClick: () => setFlowSaveOpen(false) }),
    el(
      "div",
      { className: "am-modal-shell am-modal-shell--md" },
      el(
        "div",
        { className: "am-modal-header" },
        el("h3", null, t("save_to_collection_title")),
        el("button", { type: "button", className: "am-modal-close", onClick: () => setFlowSaveOpen(false), "aria-label": t("close") }, renderIcon(icons?.X, { width: 15 }) || "×"),
      ),
      el(
        "div",
        { className: "am-modal-body space-y-3 text-ui" },
        el("input", { value: flowRequestName, onChange: (e: any) => setFlowRequestName(e.target.value), className: "am-field text-ui" }),
        Select
          ? el(
              Select,
              {
                value: flowTargetCollectionId,
                onChange: (value: string) => setFlowTargetCollectionId(value),
                className: "text-ui",
                containerClassName: "w-full",
              },
              ...collections.map((c: any) => el("option", { key: c.id, value: c.id }, c.name)),
            )
          : el(
              "select",
              {
                value: flowTargetCollectionId,
                onChange: (e: any) => setFlowTargetCollectionId(e.target.value),
                className: "am-field text-ui",
              },
              ...collections.map((c: any) => el("option", { key: c.id, value: c.id }, c.name)),
            ),
      ),
      el(
        "div",
        { className: "am-modal-footer" },
        Button ? el(Button, { variant: "outline", onClick: () => setFlowSaveOpen(false) }, t("cancel")) : null,
        Button ? el(Button, { onClick: saveFlowToCollection }, t("save")) : null,
      ),
    ),
  );
}

export function renderEnvModal(ctx: any) {
  const { el, t, Button, Input, icons, state, actions } = ctx;
  const { envOpen, envDraft, globalDraft, globalDraftRows, envEditingId, activeEnvId } = state;
  const { setEnvOpen, setEnvDraft, setGlobalDraft, setGlobalDraftRows, setEnvEditingId, setEnvironments, setGlobalVariables, setActiveEnvId, storage } = actions;
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);
  if (!envOpen) return null;

  const editing = envDraft.find((x: any) => x.id === envEditingId) || null;
  const pairs = (editing?.variableRows || Object.entries(editing?.variables || {})) as Array<[string, string]>;
  const globalPairs = (globalDraftRows || Object.entries(globalDraft || {})) as Array<[string, string]>;
  const updatePairs = (nextPairs: Array<[string, string]>) => {
    if (!editing) return;
    const nextVariables: Record<string, string> = {};
    for (const [k, v] of nextPairs) {
      const key = (k || "").trim();
      if (key) nextVariables[key] = v || "";
    }
    setEnvDraft((prev: any[]) =>
      prev.map((x: any) =>
        x.id === editing.id ? { ...x, variableRows: nextPairs, variables: nextVariables } : x,
      ),
    );
  };
  const createNextVariableKey = () => {
    const used = new Set(pairs.map(([key]) => (key || "").trim()).filter(Boolean));
    let idx = pairs.length + 1;
    let candidate = `var_${idx}`;
    while (used.has(candidate)) {
      idx += 1;
      candidate = `var_${idx}`;
    }
    return candidate;
  };
  const updateGlobalPairs = (nextPairs: Array<[string, string]>) => {
    const nextVariables: Record<string, string> = {};
    for (const [k, v] of nextPairs) {
      const key = (k || "").trim();
      if (key) nextVariables[key] = v || "";
    }
    setGlobalDraftRows(nextPairs);
    setGlobalDraft(nextVariables);
  };
  const createNextGlobalVariableKey = () => {
    const used = new Set(globalPairs.map(([key]) => (key || "").trim()).filter(Boolean));
    let idx = globalPairs.length + 1;
    let candidate = `global_${idx}`;
    while (used.has(candidate)) {
      idx += 1;
      candidate = `global_${idx}`;
    }
    return candidate;
  };
  const upsertGlobalPresetVariable = (key: string, value: string) => {
    const idx = globalPairs.findIndex(([k]) => (k || "").trim() === key);
    if (idx >= 0) {
      const next = [...globalPairs];
      next[idx] = [key, next[idx][1] || value];
      updateGlobalPairs(next);
      return;
    }
    updateGlobalPairs([...globalPairs, [key, value]]);
  };
  const addAllGlobalPresetVariables = () => {
    let next = [...globalPairs];
    for (const preset of PRESET_ENV_VARIABLES) {
      const exists = next.some(([k]) => (k || "").trim() === preset.key);
      if (!exists) next.push([preset.key, preset.value]);
    }
    updateGlobalPairs(next);
  };
  return el(
    "div",
    { className: "am-modal-overlay" },
    el("div", { className: "am-modal-backdrop", onClick: () => setEnvOpen(false) }),
    el(
      "div",
      { className: "am-modal-shell am-modal-shell--xl" },
      el(
        "div",
        { className: "am-modal-header" },
        el("h3", null, t("manage_environments")),
        el("button", { type: "button", className: "am-modal-close", onClick: () => setEnvOpen(false), "aria-label": t("close") }, renderIcon(icons?.X, { width: 15 }) || "×"),
      ),
      el(
        "div",
        { className: "am-modal-body flex gap-4 overflow-hidden text-ui h-[50vh]" },
        el(
          "div",
          { className: "shrink-0 w-60 rounded-lg border border-border/40 bg-muted/10 p-2 overflow-y-auto space-y-2" },
          ...envDraft.map((env: any) =>
            el(
              "div",
              {
                key: env.id,
                className: `px-2 py-1.5 rounded-md text-ui cursor-pointer flex items-center gap-2 border ${env.id === envEditingId ? "am-env-nav-item--active" : "am-env-nav-item--idle border-transparent"}`,
                onClick: () => setEnvEditingId(env.id),
              },
              el("span", { className: "am-dot" }),
              el("span", { className: "truncate flex-1" }, env.name),
              Button
                ? el(
                    "button",
                    {
                      type: "button",
                      className: "am-icon-btn am-danger-icon-btn rounded-md text-xs h-6 px-2",
                      onClick: (e: any) => {
                        e.stopPropagation();
                        setEnvDraft((prev: any[]) => prev.filter((x: any) => x.id !== env.id));
                        setEnvEditingId((prev: string | null) => {
                          if (prev !== env.id) return prev;
                          const remain = envDraft.filter((x: any) => x.id !== env.id);
                          return remain[0]?.id || null;
                        });
                      },
                    },
                    "×",
                  )
                : null,
            ),
          ),
          Button
            ? el(
                Button,
                {
                  variant: "outline",
                  size: "sm",
                  onClick: () => {
                    const next = {
                      id: crypto.randomUUID?.() || Date.now().toString(),
                      name: t("add_environment"),
                      variables: {},
                      variableRows: [[createNextVariableKey(), ""]],
                    };
                    setEnvDraft((prev: any[]) => [...prev, next]);
                    setEnvEditingId(next.id);
                  },
                  className: "w-full",
                },
                t("add_environment"),
              )
            : null,
        ),
        editing
          ? el(
              "div",
              { className: "flex-1 min-w-0 space-y-3 overflow-y-auto rounded-lg border border-border/40 bg-background p-3" },
              el("input", {
                value: editing.name,
                onChange: (e: any) => setEnvDraft((prev: any[]) => prev.map((x: any) => (x.id === editing.id ? { ...x, name: e.target.value } : x))),
                placeholder: t("environment_name"),
                className: "am-field text-ui",
              }),
              el(
                "div",
                { className: "space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3" },
                el("div", { className: "text-tiny text-muted-foreground font-medium tracking-wide" }, t("preset_variables")),
                el(
                  "div",
                  { className: "flex flex-wrap gap-2" },
                  ...PRESET_ENV_VARIABLES.map((preset) =>
                    Button
                      ? el(
                          Button,
                          {
                            key: preset.key,
                            variant: "outline",
                            size: "sm",
                            className: "h-7 px-2 text-xs",
                            onClick: () => upsertGlobalPresetVariable(preset.key, preset.value),
                          },
                          preset.key,
                        )
                      : null,
                  ),
                  Button
                    ? el(
                        Button,
                        {
                          variant: "ghost",
                          size: "sm",
                          className: "h-7 px-2 text-xs",
                          onClick: addAllGlobalPresetVariables,
                        },
                        t("add_all_presets"),
                      )
                    : null,
                ),
              ),
              el(
                "div",
                { className: "space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3" },
                el("div", { className: "text-tiny text-muted-foreground font-medium tracking-wide" }, t("global_environment_variables")),
                globalPairs.length === 0 ? el("div", { className: "am-empty-state text-xs px-2.5 py-2" }, t("environment_variables_empty")) : null,
                ...globalPairs.map(([k, v], idx) =>
                  el(
                    "div",
                    { key: `g-${idx}`, className: "flex items-center gap-2" },
                    el("input", {
                      value: k,
                      placeholder: t("key"),
                      className: "am-field flex-1 text-ui",
                      onChange: (e: any) => {
                        const next = [...globalPairs];
                        next[idx] = [e.target.value, next[idx][1]];
                        updateGlobalPairs(next);
                      },
                    }),
                    el("input", {
                      value: v,
                      placeholder: t("value"),
                      className: "am-field flex-1 text-ui",
                      onChange: (e: any) => {
                        const next = [...globalPairs];
                        next[idx] = [next[idx][0], e.target.value];
                        updateGlobalPairs(next);
                      },
                    }),
                    el(
                      "button",
                      {
                        type: "button",
                        onClick: () => {
                          const next = globalPairs.filter((_, i) => i !== idx);
                          updateGlobalPairs(next);
                        },
                        className: "am-icon-btn am-danger-icon-btn rounded-md shrink-0 text-xs w-9 h-9",
                      },
                      "×",
                    ),
                  ),
                ),
                Button
                  ? el(
                      Button,
                      { variant: "outline", size: "sm", className: "w-fit", onClick: () => updateGlobalPairs([...globalPairs, [createNextGlobalVariableKey(), ""]]) },
                      t("add_field"),
                    )
                  : null,
              ),
              el(
                "div",
                { className: "space-y-2 rounded-lg border border-border/50 bg-background p-3" },
                el("div", { className: "text-tiny text-muted-foreground mt-1 font-medium tracking-wide" }, t("environment_variables")),
                pairs.length === 0 ? el("div", { className: "am-empty-state text-xs px-2.5 py-2" }, t("environment_variables_empty")) : null,
                ...pairs.map(([k, v], idx) =>
                el(
                  "div",
                  { key: idx, className: "flex items-center gap-2" },
                  el("input", {
                    value: k,
                    placeholder: t("key"),
                    className: "am-field flex-1 text-ui",
                    onChange: (e: any) => {
                      const next = [...pairs];
                      next[idx] = [e.target.value, next[idx][1]];
                      updatePairs(next);
                    },
                  }),
                  el("input", {
                    value: v,
                    placeholder: t("value"),
                    className: "am-field flex-1 text-ui",
                    onChange: (e: any) => {
                      const next = [...pairs];
                      next[idx] = [next[idx][0], e.target.value];
                      updatePairs(next);
                    },
                  }),
                  el(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        const next = pairs.filter((_, i) => i !== idx);
                        updatePairs(next);
                      },
                      className: "am-icon-btn am-danger-icon-btn rounded-md shrink-0 text-xs w-9 h-9",
                    },
                    "×",
                  ),
                ),
                ),
                Button
                  ? el(
                      Button,
                      { variant: "outline", size: "sm", className: "w-fit", onClick: () => updatePairs([...pairs, [createNextVariableKey(), ""]]) },
                      t("add_field"),
                    )
                  : null,
              ),
            )
          : el("div", { className: "text-ui text-muted-foreground" }, t("select_environment")),
      ),
      el(
        "div",
        { className: "am-modal-footer" },
        Button ? el(Button, { variant: "outline", onClick: () => setEnvOpen(false) }, t("cancel")) : null,
        Button
          ? el(
              Button,
              {
                onClick: async () => {
                  const normalizedEnvs = envDraft.map((env: any) => ({
                    id: env.id,
                    name: env.name,
                    variables: { ...(env.variables || {}) },
                    ...(env.isActive !== undefined ? { isActive: env.isActive } : {}),
                  }));
                  await storage.saveEnvironments(normalizedEnvs);
                  await storage.saveGlobalVariables(globalDraft || {});
                  setEnvironments(normalizedEnvs);
                  setGlobalVariables(globalDraft || {});
                  if (!normalizedEnvs.some((x: any) => x.id === activeEnvId)) {
                    setActiveEnvId(normalizedEnvs[0]?.id || "none");
                  }
                  setEnvOpen(false);
                },
              },
              t("save"),
            )
          : null,
      ),
    ),
  );
}

export function renderRunnerModal(ctx: any) {
  const { el, t, Button, icons, state, actions } = ctx;
  const { runnerOpen, runnerCollection, runnerResults, runnerRunning, runnerDelay, runnerSelectedIds } = state;
  const { setRunnerOpen, setRunnerSelectedIds, setRunnerDelay, runCollection, stopRunner } = actions;
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);

  if (!runnerOpen) return null;

  const requests: any[] = runnerCollection?.requests || [];
  const allIds = requests.map((r: any) => r.id);
  const abbrevMethod = (m: string) =>
    ({ DELETE: "DEL", OPTIONS: "OPT", CONNECT: "CON" } as Record<string, string>)[(m || "").toUpperCase()] || m;

  const resultMap: Record<string, RunnerResult> = {};
  for (const r of runnerResults as RunnerResult[]) resultMap[r.requestId] = r;

  const anyRun = (runnerResults as RunnerResult[]).some((r) => r.state !== "pending");
  const passed = (runnerResults as RunnerResult[]).filter(
    (r) => r.state === "done" && r.status !== null && r.status < 400,
  ).length;
  const failed = (runnerResults as RunnerResult[]).filter(
    (r) => r.state === "error" || (r.state === "done" && r.status !== null && r.status >= 400),
  ).length;
  const doneCount = (runnerResults as RunnerResult[]).filter(
    (r) => r.state === "done" || r.state === "error",
  ).length;

  const handleClose = () => {
    if (runnerRunning) stopRunner();
    setRunnerOpen(false);
  };

  const statusColor = (status: number | null) => {
    if (!status) return "color-mix(in srgb, var(--color-muted-foreground) 70%, transparent)";
    if (status < 300) return "var(--color-success)";
    if (status < 400) return "var(--color-warning)";
    return "var(--color-destructive)";
  };

  return el(
    "div",
    { className: "am-modal-overlay" },
    el("div", { className: "am-modal-backdrop", onClick: handleClose }),
    el(
      "div",
      { className: "am-modal-shell am-modal-shell--lg" },
      // Header
      el(
        "div",
        { className: "am-modal-header" },
        el("h3", null, `${t("runner_title")}${runnerCollection?.name ? `: ${runnerCollection.name}` : ""}`),
        el(
          "button",
          { type: "button", className: "am-modal-close", onClick: handleClose, "aria-label": t("cancel") },
          renderIcon(icons?.X, { width: 15 }) || "×",
        ),
      ),
      // Request list
      requests.length === 0
        ? el("div", { className: "am-modal-body text-muted-foreground" }, t("collection_empty"))
        : el(
            "div",
            { className: "am-runner-list" },
            ...requests.map((r: any) => {
              const result = resultMap[r.id];
              const state = result?.state || "pending";
              const checked = runnerSelectedIds.includes(r.id);

              let statusCell: any;
              if (!anyRun || state === "pending") {
                statusCell = el("span", { style: { color: "color-mix(in srgb, var(--color-muted-foreground) 40%, transparent)" } }, "─");
              } else if (state === "running") {
                statusCell = el("span", { className: "am-runner-spinner" });
              } else if (state === "done") {
                const color = statusColor(result.status);
                statusCell = el(
                  "span",
                  { style: { color } },
                  `${result.status}  ${result.time}ms`,
                );
              } else {
                statusCell = el(
                  "span",
                  { style: { color: "var(--color-destructive)" }, title: result?.error || "" },
                  t("runner_result_error"),
                );
              }

              return el(
                "div",
                { key: r.id, className: "am-runner-row" },
                el(
                  "button",
                  {
                    type: "button",
                    className: `am-kv-toggle ${checked ? "am-kv-toggle--on" : "am-kv-toggle--off"}`,
                    disabled: runnerRunning,
                    onClick: () => {
                      if (checked) {
                        setRunnerSelectedIds(runnerSelectedIds.filter((x: string) => x !== r.id));
                      } else {
                        setRunnerSelectedIds([...runnerSelectedIds, r.id]);
                      }
                    },
                  },
                  renderIcon(checked ? icons.CheckCircle : icons.Circle, { width: 16, height: 16 }),
                ),
                el("span", { className: "am-method-badge am-method-badge--list am-method-badge--runner", "data-method": (r.method || "").toUpperCase() }, abbrevMethod(r.method)),
                el("span", { className: "truncate flex-1 text-ui", title: r.name }, r.name),
                el("span", { className: "am-runner-status" }, statusCell),
              );
            }),
          ),
      // Footer
      el(
        "div",
        { className: "am-runner-footer" },
        // Select / deselect all
        Button
          ? el(Button, { variant: "outline", className: "h-7 text-ui", disabled: runnerRunning, onClick: () => setRunnerSelectedIds(allIds) }, t("runner_select_all"))
          : null,
        Button
          ? el(Button, { variant: "outline", className: "h-7 text-ui", disabled: runnerRunning, onClick: () => setRunnerSelectedIds([]) }, t("runner_deselect_all"))
          : null,
        // Summary
        anyRun
          ? el(
              "span",
              { className: "am-runner-summary ml-2" },
              runnerRunning
                ? `${doneCount} / ${runnerResults.length}`
                : `${passed} ${t("runner_pass")} · ${failed} ${t("runner_fail")}`,
            )
          : null,
        // Spacer
        el("span", { style: { flex: 1 } }),
        // Delay input
        el(
          "label",
          { className: "flex items-center gap-1.5 text-ui text-muted-foreground shrink-0" },
          t("runner_delay_label"),
          el("input", {
            type: "number",
            min: 0,
            max: 10000,
            step: 100,
            value: runnerDelay,
            disabled: runnerRunning,
            onChange: (e: any) => setRunnerDelay(Math.max(0, Number(e.target.value) || 0)),
            className: "am-field w-14 h-7 text-center",
          }),
          t("runner_delay_unit"),
        ),
        // Run / Stop
        Button
          ? runnerRunning
            ? el(
                Button,
                { variant: "outline", className: "h-8 shrink-0", onClick: stopRunner },
                renderIcon(icons?.Square, { width: 13, style: { marginRight: 4 } }),
                t("runner_stop"),
              )
            : el(
                Button,
                {
                  className: "h-8 shrink-0",
                  disabled: runnerSelectedIds.length === 0,
                  onClick: () => runCollection({ selectedIds: runnerSelectedIds, delay: runnerDelay }),
                },
                renderIcon(icons?.Play, { width: 13, style: { marginRight: 4 } }),
                t("runner_run"),
              )
          : null,
      ),
    ),
  );
}

export function renderMoveRequestModal(ctx: any) {
  const { el, t, Button, icons, state, actions } = ctx;
  const { moveRequestOpen, moveRequestId, collections, activeCollection } = state;
  const { setMoveRequestOpen, moveRequestToCollection } = actions;
  const renderIcon = (IconComp: any, props: Record<string, unknown>) => (IconComp ? el(IconComp, props) : null);

  if (!moveRequestOpen || !moveRequestId) return null;

  const otherCollections = (collections || []).filter((c: any) => c.id !== activeCollection?.id);

  return el(
    "div",
    { className: "am-modal-overlay" },
    el("div", { className: "am-modal-backdrop", onClick: () => setMoveRequestOpen(false) }),
    el(
      "div",
      { className: "am-modal-shell am-modal-shell--md" },
      el(
        "div",
        { className: "am-modal-header" },
        el("h3", null, t("move_request_title")),
        el(
          "button",
          { type: "button", className: "am-modal-close", onClick: () => setMoveRequestOpen(false), "aria-label": t("cancel") },
          renderIcon(icons?.X, { width: 15 }) || "×",
        ),
      ),
      el(
        "div",
        { className: "am-modal-body" },
        otherCollections.length === 0
          ? el("div", { className: "text-ui text-muted-foreground py-4 text-center" }, t("no_other_collections"))
          : el(
              "div",
              { className: "space-y-1" },
              ...otherCollections.map((c: any) =>
                el(
                  "button",
                  {
                    key: c.id,
                    type: "button",
                    className: "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-ui text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                    onClick: () => void moveRequestToCollection(moveRequestId, c.id),
                  },
                  renderIcon(icons?.FolderInput, { width: 14, className: "text-muted-foreground shrink-0" }),
                  el("span", { className: "truncate" }, c.name),
                ),
              ),
            ),
      ),
      el(
        "div",
        { className: "am-modal-footer" },
        Button
          ? el(Button, { variant: "outline", onClick: () => setMoveRequestOpen(false) }, t("cancel"))
          : null,
      ),
    ),
  );
}

function MockModalContent(props: any) {
  const { el, t, hooks, Button, Input, Select, Editor, icons, mockDraft, setMockOpen, confirmCreateMock } = props;
  const { useEffect, useState } = hooks;
  const [draft, setDraft] = useState(mockDraft);
  const renderIcon = (IconComp: any, iconProps: Record<string, unknown>) => (IconComp ? el(IconComp, iconProps) : null);
  const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

  useEffect(() => {
    setDraft(mockDraft);
  }, [mockDraft]);

  const set = (key: string, value: any) => setDraft((prev: any) => ({ ...prev, [key]: value }));
  const isValid = draft.name?.trim() && draft.urlPattern?.trim();

  return el(
    "div",
    { className: "am-modal-overlay" },
    el("div", { className: "am-modal-backdrop", onClick: () => setMockOpen(false) }),
    el(
      "div",
      { className: "am-modal-shell am-modal-shell--lg" },
      el(
        "div",
        { className: "am-modal-header" },
        el("h3", null, t("mock_rule_title")),
        el(
          "button",
          { type: "button", className: "am-modal-close", onClick: () => setMockOpen(false), "aria-label": t("cancel") },
          renderIcon(icons?.X, { width: 15 }) || "×",
        ),
      ),
      el(
        "div",
        { className: "am-modal-body" },
        el(
          "div",
          { className: "flex flex-col gap-4" },
          el(
            "div",
            { className: "flex flex-col gap-1.5" },
            el("label", { className: "text-tiny font-medium text-muted-foreground uppercase tracking-wide" }, t("mock_rule_name")),
            Input
              ? el(Input, { value: draft.name, onChange: (e: any) => set("name", e.target.value), placeholder: t("mock_rule_name") })
              : el("input", { className: "am-field", value: draft.name, onChange: (e: any) => set("name", e.target.value) }),
          ),
          el(
            "div",
            { className: "flex flex-col gap-1.5" },
            el("label", { className: "text-tiny font-medium text-muted-foreground uppercase tracking-wide" }, t("mock_url_pattern")),
            Input
              ? el(Input, { value: draft.urlPattern, onChange: (e: any) => set("urlPattern", e.target.value), placeholder: "https://api.example.com/users*" })
              : el("input", { className: "am-field", value: draft.urlPattern, onChange: (e: any) => set("urlPattern", e.target.value) }),
            el("p", { className: "text-tiny text-muted-foreground mt-0.5" }, t("mock_url_pattern_hint")),
          ),
          el(
            "div",
            { className: "flex gap-3" },
            el(
              "div",
              { className: "flex flex-col gap-1.5 w-1/2" },
              el("label", { className: "text-tiny font-medium text-muted-foreground uppercase tracking-wide" }, t("mock_method")),
              Select
                ? el(
                    Select,
                    { value: draft.method || "", onChange: (v: string) => set("method", v), className: "h-9 text-ui" },
                    el("option", { value: "" }, t("mock_method_any")),
                    ...HTTP_METHODS.map((m) => el("option", { key: m, value: m }, m)),
                  )
                : el(
                    "select",
                    { className: "am-field", value: draft.method || "", onChange: (e: any) => set("method", e.target.value) },
                    el("option", { value: "" }, t("mock_method_any")),
                    ...HTTP_METHODS.map((m) => el("option", { key: m, value: m }, m)),
                  ),
            ),
            el(
              "div",
              { className: "flex flex-col gap-1.5 w-1/2" },
              el("label", { className: "text-tiny font-medium text-muted-foreground uppercase tracking-wide" }, t("mock_status_code")),
              Input
                ? el(Input, { type: "number", min: 100, max: 599, value: String(draft.statusCode), onChange: (e: any) => set("statusCode", Number(e.target.value) || 200) })
                : el("input", { type: "number", className: "am-field", value: draft.statusCode, onChange: (e: any) => set("statusCode", Number(e.target.value) || 200) }),
            ),
          ),
          el(
            "div",
            { className: "flex flex-col gap-1.5" },
            el("label", { className: "text-tiny font-medium text-muted-foreground uppercase tracking-wide" }, t("mock_content_type")),
            Input
              ? el(Input, { value: draft.contentType, onChange: (e: any) => set("contentType", e.target.value), placeholder: "application/json" })
              : el("input", { className: "am-field", value: draft.contentType, onChange: (e: any) => set("contentType", e.target.value) }),
          ),
          el(
            "div",
            { className: "flex flex-col gap-1.5" },
            el("label", { className: "text-tiny font-medium text-muted-foreground uppercase tracking-wide" }, t("mock_response_body")),
            el(
              "div",
              { style: { height: 180, flexShrink: 0, overflow: "hidden", borderRadius: 6, border: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)" } },
              Editor
                ? el(Editor, {
                    value: draft.responseBody,
                    onChange: (v: string) => set("responseBody", v ?? ""),
                    language: (draft.contentType || "").includes("json") ? "json" : "text",
                    height: "100%",
                  })
                : el("textarea", {
                    className: "am-field w-full h-full resize-none border-0",
                    style: { height: "100%", fontFamily: "var(--font-mono)" },
                    value: draft.responseBody,
                    onChange: (e: any) => set("responseBody", e.target.value),
                  }),
            ),
          ),
        ),
      ),
      el(
        "div",
        { className: "am-modal-footer" },
        Button ? el(Button, { variant: "outline", onClick: () => setMockOpen(false) }, t("cancel")) : null,
        Button
          ? el(
              Button,
              { disabled: !isValid, onClick: () => void confirmCreateMock(draft) },
              renderIcon(icons?.Check, { width: 13, style: { marginRight: 4 } }),
              t("mock_create_confirm"),
            )
          : null,
      ),
    ),
  );
}

export function renderMockModal(ctx: any) {
  const { el, t, hooks, Button, Input, Select, Editor, icons, state, actions } = ctx;
  const { mockOpen, mockDraft } = state;
  const { setMockOpen, confirmCreateMock } = actions;

  if (!mockOpen || !mockDraft) return null;

  return el(MockModalContent, {
    el,
    t,
    hooks,
    Button,
    Input,
    Select,
    Editor,
    icons,
    mockDraft,
    setMockOpen,
    confirmCreateMock,
  });
}
