import type { ApiRequest, AuthConfig, HeaderItem, ImportedApiRequest, ImportedExampleValue, ImportedRequestExamples, ParamItem, PathParamMeta } from "../types";

function resolveRef(root: any, value: any): any {
  const ref = value?.$ref;
  if (!ref || typeof ref !== "string" || !ref.startsWith("#/")) return value;
  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = root;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return value;
    current = current[segment];
  }
  return current ?? value;
}

function dereference(root: any, value: any, seen = new Set<string>()) {
  if (!value || typeof value !== "object" || !value.$ref || typeof value.$ref !== "string") {
    return value;
  }
  const ref = value.$ref;
  if (seen.has(ref)) return value;
  const resolved = resolveRef(root, value);
  if (!resolved || resolved === value) return value;
  return dereference(root, resolved, new Set([...seen, ref]));
}

function stringifyExampleValue(value: unknown) {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildSchemaSample(root: any, schemaLike: any, seen = new Set<string>()): unknown {
  // Handle $ref - resolve it first
  const ref = schemaLike?.$ref;
  if (typeof ref === "string") {
    if (seen.has(ref)) return undefined;
    const resolved = resolveRef(root, schemaLike);
    if (!resolved || resolved === schemaLike) return undefined;
    return buildSchemaSample(root, resolved, new Set([...seen, ref]));
  }

  // No $ref, continue with normal processing
  const schema = schemaLike;
  if (!schema || typeof schema !== "object") return undefined;

  // Check for example/default at this level first
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  // Handle enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle oneOf/anyOf - take first option
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return buildSchemaSample(root, schema.oneOf[0], seen);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return buildSchemaSample(root, schema.anyOf[0], seen);
  }

  // Handle allOf - merge all parts
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const merged: Record<string, unknown> = {};
    let hasObjectShape = false;
    for (const part of schema.allOf) {
      const sample = buildSchemaSample(root, part, seen);
      if (sample && typeof sample === "object" && !Array.isArray(sample)) {
        Object.assign(merged, sample);
        hasObjectShape = true;
      }
    }
    if (hasObjectShape) return merged;
  }

  // Determine schema type
  const schemaType = schema.type;

  // Handle object type (including when only properties exist without explicit type)
  if (schemaType === "object" || schema.properties || schema.additionalProperties) {
    const result: Record<string, unknown> = {};
    let hasValue = false;

    // Process each property
    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries<any>(schema.properties)) {
        const sample = buildSchemaSample(root, propertySchema, seen);
        if (sample !== undefined) {
          result[key] = sample;
          hasValue = true;
        } else {
          // Even if sample is undefined, include the key with a sensible default based on property type
          const propType = propertySchema?.type;
          if (propType === "string") result[key] = "";
          else if (propType === "integer" || propType === "number") result[key] = 0;
          else if (propType === "boolean") result[key] = false;
          else if (propType === "array") result[key] = [];
          else if (propType === "object" || propertySchema?.properties) result[key] = {};
          else result[key] = null;
          hasValue = true;
        }
      }
    }

    // Handle additionalProperties
    if (!hasValue && schema.additionalProperties) {
      if (typeof schema.additionalProperties === "boolean") {
        result.additionalProp1 = "";
        hasValue = true;
      } else if (typeof schema.additionalProperties === "object") {
        const sample = buildSchemaSample(root, schema.additionalProperties, seen);
        if (sample !== undefined) {
          result.additionalProp1 = sample;
          hasValue = true;
        }
      }
    }

    // If we have a schema with properties but no values were generated, return empty object
    if (schema.properties && Object.keys(schema.properties).length > 0 && !hasValue) {
      return result;
    }

    return hasValue ? result : undefined;
  }

  // Handle array type
  if (schemaType === "array" || schema.items) {
    const itemSample = schema.items ? buildSchemaSample(root, schema.items, seen) : undefined;
    if (itemSample !== undefined) return [itemSample];
    // Return empty array if we can't determine item type
    return [];
  }

  // Handle scalar types
  if (schemaType === "integer" || schemaType === "number") return 0;
  if (schemaType === "boolean") return false;
  if (schemaType === "string") {
    if (schema.format === "date-time") return new Date().toISOString();
    if (schema.format === "date") return "2026-01-01";
    if (schema.format === "email") return "user@example.com";
    if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
    if (schema.format === "uri") return "https://example.com";
    if (schema.format === "ipv4") return "127.0.0.1";
    if (schema.format === "hostname") return "example.com";
    if (schema.format === "password") return "********";
    if (schema.format === "byte") return "dGVzdA==";
    if (schema.format === "binary") return "binary data";
    return "";
  }

  // Fallback: if schema is an object but we couldn't determine the type
  if (typeof schema === "object" && Object.keys(schema).length > 0) {
    return undefined;
  }

  return undefined;
}

function createExampleItem(
  generateId: () => string,
  name: string,
  value: unknown,
  source: ImportedExampleValue["source"],
  opts?: { summary?: string; description?: string; mediaType?: string },
): ImportedExampleValue | null {
  if (value === undefined) return null;
  return {
    id: generateId(),
    name,
    summary: opts?.summary,
    description: opts?.description,
    value: stringifyExampleValue(value),
    source,
    mediaType: opts?.mediaType,
  };
}

function collectExampleItems(
  root: any,
  source: any,
  generateId: () => string,
  opts?: { mediaType?: string },
): ImportedExampleValue[] {
  const resolvedSource = dereference(root, source);
  const items: ImportedExampleValue[] = [];
  const directExample = createExampleItem(generateId, "default", resolvedSource?.example, "example", opts);
  if (directExample) items.push(directExample);

  const namedExamples = resolvedSource?.examples;
  if (namedExamples && typeof namedExamples === "object") {
    for (const [name, exampleObj] of Object.entries(namedExamples)) {
      const resolvedExample = dereference(root, exampleObj);
      const exampleValue = (resolvedExample as any)?.value;
      const item = createExampleItem(generateId, name, exampleValue, "examples", {
        summary: (resolvedExample as any)?.summary,
        description: (resolvedExample as any)?.description,
        mediaType: opts?.mediaType,
      });
      if (item) items.push(item);
    }
  }

  // Handle both Swagger 2.0 (schema) and OpenAPI 3.x (content) parameter styles
  const schema = resolvedSource?.schema || resolvedSource?.content?.["application/json"]?.schema;
  const resolvedSchema = schema ? dereference(root, schema) : undefined;

  const schemaExample = createExampleItem(
    generateId,
    "schema",
    resolvedSchema?.example,
    "schema_example",
    opts,
  );
  if (schemaExample) items.push(schemaExample);

  const schemaDefault = createExampleItem(
    generateId,
    "default",
    resolvedSchema?.default,
    "schema_default",
    opts,
  );
  if (schemaDefault) items.push(schemaDefault);

  const generatedSample = buildSchemaSample(root, schema);
  const generatedExample = createExampleItem(
    generateId,
    "generated",
    generatedSample,
    "schema_generated",
    opts,
  );
  if (generatedExample) items.push(generatedExample);

  return items;
}

function pickPreferredMediaType(content: Record<string, any> | undefined) {
  const entries = Object.entries(content || {});
  if (entries.length === 0) return null;
  return (
    entries.find(([mediaType]) => mediaType === "application/json") ||
    entries.find(([mediaType]) => mediaType.includes("json")) ||
    entries[0]
  );
}

function normalizeOpenApiPathTemplate(path: string, pathParams: PathParamMeta[]) {
  if (!path) return path;
  const knownParams = new Set(pathParams.map((param) => param.name));
  return path.replace(/\{([^}]+)\}/g, (match, rawName) => {
    const name = String(rawName || "").trim();
    if (!name) return match;
    if (knownParams.size > 0 && !knownParams.has(name)) return match;
    return `{{${name}}}`;
  });
}

function normalizePath(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`;
}

function extractPathFromServerUrl(serverUrl: string) {
  const raw = String(serverUrl || "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/\{[^}]+\}/g, "x");
  try {
    const parsed = new URL(normalized);
    return normalizePath(parsed.pathname || "");
  } catch {
    if (normalized.startsWith("/")) return normalizePath(normalized);
    return "";
  }
}

function resolveSpecBasePath(spec: any) {
  if (Array.isArray(spec?.servers) && spec.servers.length > 0) {
    const firstServer = spec.servers.find((s: any) => typeof s?.url === "string" && String(s.url).trim());
    const serverPath = firstServer ? extractPathFromServerUrl(String(firstServer.url)) : "";
    if (serverPath) return serverPath;
  }
  const swaggerBasePath = normalizePath(String(spec?.basePath || ""));
  if (swaggerBasePath) return swaggerBasePath;
  return "";
}

function withBasePath(path: string, basePath: string) {
  const normalizedPath = normalizePath(path) || "/";
  const normalizedBase = normalizePath(basePath);
  if (!normalizedBase) return normalizedPath;
  if (normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`)) return normalizedPath;
  return `${normalizedBase}${normalizedPath === "/" ? "" : normalizedPath}`;
}

function getSecuritySchemes(spec: any): Record<string, any> {
  return {
    ...(spec?.components?.securitySchemes || {}),
    ...(spec?.securityDefinitions || {}),
  };
}

function toSecuritySchemeAuth(name: string, scheme: any): AuthConfig | undefined {
  const schemeType = String(scheme?.type || "").toLowerCase();
  if (!schemeType) return undefined;
  if (schemeType === "basic") {
    return {
      type: "basic",
      basicUser: "{{username}}",
      basicPass: "{{password}}",
    };
  }
  if (schemeType === "http") {
    const httpScheme = String(scheme?.scheme || "").toLowerCase();
    if (httpScheme === "bearer") {
      return {
        type: "bearer",
        bearer: "{{token}}",
      };
    }
    if (httpScheme === "basic") {
      return {
        type: "basic",
        basicUser: "{{username}}",
        basicPass: "{{password}}",
      };
    }
    return undefined;
  }
  if (schemeType === "apikey") {
    const schemeLocation = String(scheme?.in || "").toLowerCase();
    if (schemeLocation === "cookie") {
      const cookieName = String(scheme?.name || name || "apiKey");
      return {
        type: "apikey",
        apikeyKey: "Cookie",
        apikeyValue: `${cookieName}={{apiKey}}`,
        apikeyLocation: "header",
      };
    }
    return {
      type: "apikey",
      apikeyKey: String(scheme?.name || name || "X-API-Key"),
      apikeyValue: "{{apiKey}}",
      apikeyLocation: schemeLocation === "query" ? "query" : "header",
    };
  }
  return undefined;
}

function resolveOperationAuth(spec: any, operation: any): AuthConfig | undefined {
  if (Array.isArray(operation?.security) && operation.security.length === 0) {
    return { type: "none" };
  }
  const requirements = Array.isArray(operation?.security)
    ? operation.security
    : Array.isArray(spec?.security)
      ? spec.security
      : null;
  if (!requirements || requirements.length === 0) return undefined;
  const schemes = getSecuritySchemes(spec);
  for (const requirement of requirements) {
    if (!requirement || typeof requirement !== "object") continue;
    for (const name of Object.keys(requirement)) {
      const rawScheme = schemes[name];
      if (!rawScheme) continue;
      const scheme = dereference(spec, rawScheme);
      const auth = toSecuritySchemeAuth(name, scheme);
      if (auth) return auth;
    }
  }
  return undefined;
}

function buildFormBodyItemsFromValue(value: unknown): Array<{ key: string; value: string; enabled: boolean }> {
  const toItemsFromObject = (obj: Record<string, unknown>) =>
    Object.entries(obj).map(([key, raw]) => ({
      key,
      value:
        raw === null || raw === undefined
          ? ""
          : typeof raw === "string"
            ? raw
            : typeof raw === "number" || typeof raw === "boolean"
              ? String(raw)
              : JSON.stringify(raw),
      enabled: true,
    }));

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return toItemsFromObject(value as Record<string, unknown>);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return toItemsFromObject(parsed as Record<string, unknown>);
    }
  } catch {}

  const params = new URLSearchParams(trimmed);
  const items: Array<{ key: string; value: string; enabled: boolean }> = [];
  params.forEach((paramValue, key) => {
    items.push({ key, value: paramValue, enabled: true });
  });
  return items;
}

export function parseOpenApi(spec: any, generateId: () => string): ImportedApiRequest[] {
  type SortableImportedApiRequest = ImportedApiRequest & {
    _tagOrder?: number;
    _path?: string;
    _methodOrder?: number;
  };
  const requests: SortableImportedApiRequest[] = [];
  const paths = spec?.paths || {};
  const specBasePath = resolveSpecBasePath(spec);
  const methodOrder: Record<string, number> = {
    GET: 0,
    POST: 1,
    PUT: 2,
    DELETE: 3,
    PATCH: 4,
    HEAD: 5,
    OPTIONS: 6,
  };

  // Build tag order map from the spec's top-level tags array
  const tagOrder: Record<string, number> = {};
  if (Array.isArray(spec?.tags)) {
    spec.tags.forEach((tagDef: any, idx: number) => {
      const tagName = typeof tagDef === "string" ? tagDef : (tagDef?.name || "");
      if (tagName) tagOrder[tagName] = idx;
    });
  }
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of ["get", "post", "put", "delete", "patch", "head", "options"]) {
      const operation = (pathItem as any)?.[method];
      if (!operation) continue;
      const examples: ImportedRequestExamples = {};
      const params: ParamItem[] = [];
      const pathParams: PathParamMeta[] = [];
      const headers: HeaderItem[] = [];

      const allParameters = [
        ...((pathItem as any)?.parameters || []),
        ...(operation.parameters || []),
      ].map((parameter) => dereference(spec, parameter));
      const cookieParams: Array<{ name: string; value: string; required: boolean }> = [];

      for (const parameter of allParameters) {
        const name = String(parameter?.name || "").trim();
        const location = String(parameter?.in || "").trim();
        if (!name || !location) continue;

        // Skip body parameters - handle separately below
        if (location === "body") continue;

        // Determine if this parameter is required
        // OpenAPI 3.x: required is a boolean on the parameter itself
        // For path params, they are always required
        const isRequired = location === "path" || parameter?.required === true;

        const parameterExamples = collectExampleItems(spec, parameter, generateId);
        const selectedExample = parameterExamples[0];
        const selectedValue = selectedExample?.value ?? `{{${name}}}`;

        if (location === "path") {
          pathParams.push({
            name,
            required: true,
            selectedExampleId: selectedExample?.id,
            ...(parameterExamples.length > 0 ? { examples: parameterExamples } : {}),
          });
        } else if (location === "query") {
          params.push({ key: name, value: selectedValue, enabled: true, required: isRequired || undefined });
          if (parameterExamples.length > 0) {
            examples.params = {
              ...(examples.params || {}),
              [name]: {
                selectedId: selectedExample?.id,
                items: parameterExamples,
              },
            };
          }
        } else if (location === "header") {
          headers.push({ key: name, value: selectedValue, enabled: true, required: isRequired || undefined });
          if (parameterExamples.length > 0) {
            examples.headers = {
              ...(examples.headers || {}),
              [name]: {
                selectedId: selectedExample?.id,
                items: parameterExamples,
              },
            };
          }
        } else if (location === "cookie") {
          cookieParams.push({
            name,
            value: selectedValue,
            required: isRequired,
          });
        }
      }
      if (cookieParams.length > 0) {
        const cookieValue = cookieParams
          .map((cookieParam) => `${cookieParam.name}=${cookieParam.value}`)
          .join("; ");
        const existingCookieHeader = headers.find((header) => header.key.toLowerCase() === "cookie");
        if (existingCookieHeader) {
          existingCookieHeader.value = existingCookieHeader.value
            ? `${existingCookieHeader.value}; ${cookieValue}`
            : cookieValue;
          existingCookieHeader.required =
            existingCookieHeader.required || cookieParams.some((cookieParam) => cookieParam.required) || undefined;
        } else {
          headers.push({
            key: "Cookie",
            value: cookieValue,
            enabled: true,
            required: cookieParams.some((cookieParam) => cookieParam.required) || undefined,
          });
        }
      }

      // Handle body parameters (Swagger 2.0 style)
      const bodyParams = allParameters.filter((p: any) => p?.in === "body");
      let requestBody: any = null;
      let isBodyRequired = false;
      if (bodyParams.length > 0) {
        const firstBodyParam = bodyParams[0];
        isBodyRequired = firstBodyParam?.required === true;
        // For body params, the schema is directly in the parameter
        requestBody = {
          content: {
            "application/json": {
              schema: firstBodyParam.schema,
              example: firstBodyParam.example,
              examples: firstBodyParam.examples,
            },
          },
        };
      } else {
        // OpenAPI 3.x style requestBody
        requestBody = dereference(spec, operation.requestBody);
        isBodyRequired = requestBody?.required === true;
      }
      const preferredMedia = pickPreferredMediaType(requestBody?.content);
      const reqBody = preferredMedia?.[1];
      const reqBodyMediaType = preferredMedia?.[0];
      const bodyExamples = collectExampleItems(spec, reqBody, generateId, {
        mediaType: reqBodyMediaType,
      });
      const selectedBodyExample = bodyExamples[0];
      let body = selectedBodyExample ? selectedBodyExample.value : null;
      let bodyType: ApiRequest["bodyType"] = body ? "raw" : "none";
      if (reqBodyMediaType === "application/x-www-form-urlencoded") {
        const formItems = buildFormBodyItemsFromValue(body);
        if (formItems.length > 0) {
          body = JSON.stringify(formItems);
          bodyType = "x-www-form-urlencoded";
        }
      }
      const auth = resolveOperationAuth(spec, operation);

      if (bodyExamples.length > 0) {
        examples.body = {
          selectedId: selectedBodyExample?.id,
          items: bodyExamples,
        };
      }

      const request: ApiRequest = {
        id: generateId(),
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        url: `{{BASE_URL}}${normalizeOpenApiPathTemplate(withBasePath(path, specBasePath), pathParams)}`,
        headers: [
          ...(headers.length > 0 ? headers : []),
          ...(reqBodyMediaType && !headers.some((header) => header.key.toLowerCase() === "content-type")
            ? [{ key: "Content-Type", value: reqBodyMediaType, enabled: true }]
            : []),
        ],
        params,
        ...(pathParams.length > 0 ? { pathParams } : {}),
        body,
        bodyType,
        ...(auth ? { auth } : {}),
        bodyRequired: isBodyRequired || undefined,
        description: operation.description || "",
        ...(examples.body || examples.params || examples.headers ? { examples } : {}),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const tag = Array.isArray(operation.tags) && operation.tags.length > 0 ? String(operation.tags[0] || "").trim() || null : null;
      requests.push({
        request,
        tag,
        _tagOrder: tag && tagOrder[tag] !== undefined ? tagOrder[tag] : 9999,
        _path: path,
        _methodOrder: methodOrder[method.toUpperCase()] ?? 9999,
      });
    }
  }

  // Sort: by tag order, then path, then method
  const sorted = requests.sort((a, b) => {
    const tagDiff = (a._tagOrder ?? 9999) - (b._tagOrder ?? 9999);
    if (tagDiff !== 0) return tagDiff;
    const pathDiff = String(a._path || "").localeCompare(String(b._path || ""));
    if (pathDiff !== 0) return pathDiff;
    return (a._methodOrder ?? 9999) - (b._methodOrder ?? 9999);
  });
  sorted.forEach((r) => {
    delete (r as any)._tagOrder;
    delete (r as any)._path;
    delete (r as any)._methodOrder;
  });
  return sorted;
}
