/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ApiRequest, HeaderItem, ImportedApiRequest } from "../types";
import type { RequestBodyType } from "../utils";

type PostmanUrl = string | { raw?: string };
type PostmanBody = {
  mode?: string;
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>;
};
type PostmanRequest = {
  method?: string;
  url?: PostmanUrl;
  header?: Array<{ key: string; value: string; disabled?: boolean }>;
  body?: PostmanBody;
  description?: string | { content?: string };
};
type PostmanItem = {
  name?: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
};

export function isPostmanCollection(doc: any): boolean {
  return (
    doc &&
    typeof doc === "object" &&
    Array.isArray(doc.item) &&
    doc.info &&
    typeof doc.info === "object"
  );
}

function getUrlRaw(url: PostmanUrl | undefined): string {
  if (!url) return "";
  if (typeof url === "string") return url;
  return url.raw || "";
}

function parsePostmanBody(body: PostmanBody | undefined): { bodyType: RequestBodyType; body: string | null } {
  if (!body) return { bodyType: "none", body: null };
  const mode = body.mode || "";
  if (mode === "raw") {
    return { bodyType: "raw", body: body.raw || null };
  }
  if (mode === "urlencoded" && Array.isArray(body.urlencoded)) {
    const items = body.urlencoded
      .filter((x) => !x.disabled)
      .map((x) => ({ key: x.key || "", value: x.value || "", enabled: true }));
    return { bodyType: "x-www-form-urlencoded", body: JSON.stringify(items) };
  }
  if (mode === "formdata" && Array.isArray(body.formdata)) {
    const items = body.formdata
      .filter((x) => !x.disabled && x.type !== "file")
      .map((x) => ({ key: x.key || "", value: x.value || "", enabled: true }));
    return { bodyType: "x-www-form-urlencoded", body: JSON.stringify(items) };
  }
  return { bodyType: "none", body: null };
}

function flattenItems(items: PostmanItem[], generateId: () => string, parentFolderPath: string | null = null): ImportedApiRequest[] {
  const requests: ImportedApiRequest[] = [];
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const folderName = String(item.name || "").trim() || "Folder";
      const nextFolderPath = parentFolderPath ? `${parentFolderPath} / ${folderName}` : folderName;
      requests.push(...flattenItems(item.item, generateId, nextFolderPath));
    } else if (item.request) {
      const req = item.request;
      const url = getUrlRaw(req.url);
      const headers: HeaderItem[] = (req.header || [])
        .filter((h) => !h.disabled)
        .map((h) => ({ key: h.key || "", value: h.value || "", enabled: true }));
      const { bodyType, body } = parsePostmanBody(req.body);
      const description =
        typeof req.description === "string"
          ? req.description
          : (req.description as any)?.content || undefined;
      const request: ApiRequest = {
        id: generateId(),
        name: item.name || url || "Request",
        method: (req.method || "GET").toUpperCase(),
        url,
        headers,
        body,
        bodyType,
        description,
        postExtract: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      requests.push({
        request,
        tag: parentFolderPath,
      });
    }
  }
  return requests;
}

export function parsePostmanCollection(doc: any, generateId: () => string): ImportedApiRequest[] {
  if (!doc?.item) return [];
  return flattenItems(doc.item as PostmanItem[], generateId);
}
