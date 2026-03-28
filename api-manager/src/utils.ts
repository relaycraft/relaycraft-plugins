export const generateId = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);

const BUILTIN_VARIABLES: Record<string, () => string> = {
  $timestamp: () => String(Date.now()),
  $isoTimestamp: () => new Date().toISOString(),
  $randomUUID: () => globalThis.crypto?.randomUUID?.() ?? generateId(),
};

export const PRESET_ENV_VARIABLES: Array<{ key: string; value: string }> = [
  { key: "timestamp", value: "{{$timestamp}}" },
  { key: "isoTimestamp", value: "{{$isoTimestamp}}" },
  { key: "uuid", value: "{{$randomUUID}}" },
];

export function resolveVariables(text: string, variables: Record<string, string>) {
  if (!text) return "";
  const resolveBuiltins = (value: string) =>
    String(value || "").replace(/\{\{(\$?\w+)\}\}/g, (_, key) => {
      if (BUILTIN_VARIABLES[key]) return BUILTIN_VARIABLES[key]();
      return `{{${key}}}`;
    });
  return text.replace(/\{\{(\$?\w+)\}\}/g, (_, key) => {
    if (BUILTIN_VARIABLES[key]) return BUILTIN_VARIABLES[key]();
    if (variables[key] !== undefined) return resolveBuiltins(variables[key]);
    return `{{${key}}}`;
  });
}

export type FormBodyItem = { key: string; value: string; enabled: boolean };
export type RequestBodyType = "none" | "raw" | "x-www-form-urlencoded";
export const FORM_BODY_TYPE: RequestBodyType = "x-www-form-urlencoded";

export function normalizeRequestBodyType(value: string | null | undefined): RequestBodyType {
  if (value === "raw") return "raw";
  if (value === FORM_BODY_TYPE || value === "form") return FORM_BODY_TYPE;
  return "none";
}

export function parseFormBodyItems(bodyText: string | null): FormBodyItem[] {
  const raw = String(bodyText || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        key: String(item?.key || ""),
        value: String(item?.value || ""),
        enabled: item?.enabled !== false,
      }));
    }
  } catch {}
  const params = new URLSearchParams(raw);
  const pairs: FormBodyItem[] = [];
  params.forEach((value, key) => {
    pairs.push({ key, value, enabled: true });
  });
  return pairs;
}

export function serializeFormBodyItems(items: FormBodyItem[]) {
  const params = new URLSearchParams();
  items.forEach((item) => {
    if (item.enabled !== false && item.key) {
      params.append(item.key, item.value || "");
    }
  });
  return params.toString();
}

function shellQuote(s: string): string {
  // No quoting needed for simple alphanumeric + safe chars
  if (!/[ \t\n'"\\$`!{}[\]<>|&;()]/.test(s)) return s;
  // Single-quote with escaped embedded single quotes
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export function applyAuth(
  auth: any,
  headers: Record<string, string>,
  url: string,
  resolveVar: (s: string) => string,
): { headers: Record<string, string>; url: string } {
  if (!auth || auth.type === "none" || !auth.type) return { headers, url };
  const h = { ...headers };
  let u = url;
  if (auth.type === "bearer") {
    const token = resolveVar(auth.bearer || "");
    if (token) h["Authorization"] = `Bearer ${token}`;
  } else if (auth.type === "basic") {
    const user = resolveVar(auth.basicUser || "");
    const pass = resolveVar(auth.basicPass || "");
    if (user || pass) h["Authorization"] = `Basic ${btoa(`${user}:${pass}`)}`;
  } else if (auth.type === "apikey") {
    const key = resolveVar(auth.apikeyKey || "");
    const val = resolveVar(auth.apikeyValue || "");
    if (key) {
      if (auth.apikeyLocation === "query") {
        u = u.includes("?") ? `${u}&${encodeURIComponent(key)}=${encodeURIComponent(val)}` : `${u}?${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
      } else {
        h[key] = val;
      }
    }
  }
  return { headers: h, url: u };
}

export function appendParamsToUrl(baseUrl: string, params: Array<{ key: string; value: string; enabled: boolean }> | undefined): string {
  if (!params || params.length === 0) return baseUrl;
  const enabled = params.filter((p) => p.enabled !== false && p.key);
  if (enabled.length === 0) return baseUrl;
  const qs = enabled.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || "")}`).join("&");
  return baseUrl.includes("?") ? `${baseUrl}&${qs}` : `${baseUrl}?${qs}`;
}

export function extractRequestName(method: string, url: string): string {
  const m = (method || "GET").toUpperCase();
  if (!url) return m;
  try {
    const parsed = new URL(url);
    return `${m} ${parsed.pathname || "/"}`;
  } catch {
    const withoutQuery = url.split("?")[0];
    const match = withoutQuery.match(/^https?:\/\/[^/]+(\/.*)?$/i);
    if (match) return `${m} ${match[1] || "/"}`;
    return `${m} ${withoutQuery}`;
  }
}

export function buildCurlCommand(request: {
  method?: string;
  url?: string;
  headers?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string | null;
  bodyType?: string;
}): string {
  const parts: string[] = [`curl -X ${request.method || "GET"}`, shellQuote(request.url || "")];
  for (const h of request.headers || []) {
    if (!h.enabled || !h.key) continue;
    parts.push(`-H ${shellQuote(`${h.key}: ${h.value}`)}`);
  }
  if (request.body && request.bodyType && request.bodyType !== "none") {
    let bodyStr = request.body;
    if (request.bodyType === "x-www-form-urlencoded") {
      try {
        const items = JSON.parse(bodyStr);
        if (Array.isArray(items)) {
          const params = new URLSearchParams();
          (items as FormBodyItem[]).forEach((item) => {
            if (item.enabled !== false && item.key) params.append(item.key, item.value || "");
          });
          bodyStr = params.toString();
        }
      } catch {}
    }
    parts.push(`--data-raw ${shellQuote(bodyStr)}`);
  }
  return parts.join(" \\\n  ");
}
