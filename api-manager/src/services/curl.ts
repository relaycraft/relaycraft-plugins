/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ApiRequest } from "../types";

// ──── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(input: string): string[] {
  // Remove line continuations (\ followed by newline)
  const normalized = input.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    if (/\s/.test(normalized[i])) { i++; continue; }
    // Single-quoted string: no escape processing inside single quotes
    if (normalized[i] === "'") {
      i++;
      let tok = "";
      while (i < normalized.length && normalized[i] !== "'") tok += normalized[i++];
      i++; // closing '
      tokens.push(tok);
      continue;
    }
    // Double-quoted string: handle backslash escapes
    if (normalized[i] === '"') {
      i++;
      let tok = "";
      while (i < normalized.length && normalized[i] !== '"') {
        if (normalized[i] === '\\' && i + 1 < normalized.length) {
          i++;
          const c = normalized[i];
          tok += c === 'n' ? '\n' : c === 't' ? '\t' : c === '"' ? '"' : c === '\\' ? '\\' : `\\${c}`;
        } else {
          tok += normalized[i];
        }
        i++;
      }
      i++; // closing "
      tokens.push(tok);
      continue;
    }
    // Bare token
    let tok = "";
    while (i < normalized.length && !/\s/.test(normalized[i])) tok += normalized[i++];
    tokens.push(tok);
  }
  return tokens;
}

// ──── Parser ──────────────────────────────────────────────────────────────────

// Flags whose next token is a value we don't use
const SKIP_ARG_FLAGS = new Set([
  "-o", "--output", "--max-time", "--connect-timeout",
  "-A", "--user-agent", "--proxy", "-x",
  "--cacert", "--cert", "--key", "--cookie", "-b",
  "--cookie-jar", "-c", "--referer", "-e",
  "--interface", "--resolve", "--dns-servers",
  "--limit-rate", "--retry", "--retry-delay",
]);

// Boolean flags with no argument
const BOOL_FLAGS = new Set([
  "-L", "--location", "--compressed", "--insecure", "-k",
  "--silent", "-s", "--verbose", "-v", "--include", "-i",
  "--no-buffer", "--fail", "-f", "--progress-bar",
  "--http1.0", "--http1.1", "--http2",
  "--get", "-G", "--head", "-I",
  "--no-keepalive", "--keepalive-time",
  "--tcp-nodelay", "--no-alpn", "--no-npn",
]);

export function parseCurl(input: string, generateId: () => string): ApiRequest | null {
  const tokens = tokenize(input.trim());
  if (!tokens.length || tokens[0].toLowerCase() !== "curl") return null;

  let method: string | null = null;
  let url: string | null = null;
  const headers: Array<{ key: string; value: string; enabled: boolean }> = [];
  const dataParts: string[] = [];
  let bodyType: "none" | "raw" | "x-www-form-urlencoded" = "none";

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === "-X" || tok === "--request") {
      method = tokens[++i] || "GET";
      i++;
      continue;
    }
    if (tok === "-H" || tok === "--header") {
      const raw = tokens[++i] || "";
      const colon = raw.indexOf(":");
      if (colon > 0) {
        headers.push({
          key: raw.slice(0, colon).trim(),
          value: raw.slice(colon + 1).trim(),
          enabled: true,
        });
      }
      i++;
      continue;
    }
    if (
      tok === "-d" || tok === "--data" ||
      tok === "--data-raw" || tok === "--data-ascii" ||
      tok === "--data-binary"
    ) {
      dataParts.push(tokens[++i] || "");
      bodyType = "raw";
      i++;
      continue;
    }
    if (tok === "--data-urlencode") {
      dataParts.push(tokens[++i] || "");
      bodyType = "x-www-form-urlencoded";
      i++;
      continue;
    }
    if (tok === "-u" || tok === "--user") {
      const creds = tokens[++i] || "";
      try {
        headers.push({
          key: "Authorization",
          value: `Basic ${btoa(creds)}`,
          enabled: true,
        });
      } catch {}
      i++;
      continue;
    }
    if (BOOL_FLAGS.has(tok)) { i++; continue; }
    if (SKIP_ARG_FLAGS.has(tok)) { i += 2; continue; }
    // Skip unknown flags (single or double dash)
    if (tok.startsWith("-")) { i++; continue; }
    // URL — first bare token
    if (!url) {
      url = tok;
      i++;
      continue;
    }
    i++;
  }

  if (!url) return null;

  const body = dataParts.length > 0 ? dataParts.join("&") : null;
  if (!method) method = body ? "POST" : "GET";

  return {
    id: generateId(),
    name: `${method} ${url}`,
    method: method.toUpperCase(),
    url,
    headers,
    body: body || null,
    bodyType: body ? bodyType : "none",
    postExtract: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
