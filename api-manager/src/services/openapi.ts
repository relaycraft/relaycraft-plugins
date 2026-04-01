import type { ApiRequest, HeaderItem, ImportedApiRequest, ImportedExampleValue, ImportedRequestExamples, ParamItem, PathParamMeta } from "../types";

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

  const schemaExample = createExampleItem(
    generateId,
    "schema",
    dereference(root, resolvedSource?.schema)?.example,
    "schema_example",
    opts,
  );
  if (schemaExample) items.push(schemaExample);

  const schemaDefault = createExampleItem(
    generateId,
    "default",
    dereference(root, resolvedSource?.schema)?.default,
    "schema_default",
    opts,
  );
  if (schemaDefault) items.push(schemaDefault);

  const generatedSample = buildSchemaSample(root, resolvedSource?.schema);
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

export function parseOpenApi(spec: any, generateId: () => string): ImportedApiRequest[] {
  const requests: ImportedApiRequest[] = [];
  const paths = spec?.paths || {};
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

      for (const parameter of allParameters) {
        const name = String(parameter?.name || "").trim();
        const location = String(parameter?.in || "").trim();
        if (!name || !location) continue;

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
        }
      }

      const requestBody = dereference(spec, operation.requestBody);
      const preferredMedia = pickPreferredMediaType(requestBody?.content);
      const reqBody = preferredMedia?.[1];
      const reqBodyMediaType = preferredMedia?.[0];
      const bodyExamples = collectExampleItems(spec, reqBody, generateId, {
        mediaType: reqBodyMediaType,
      });
      const selectedBodyExample = bodyExamples[0];
      const body = selectedBodyExample ? selectedBodyExample.value : null;

      if (bodyExamples.length > 0) {
        examples.body = {
          selectedId: selectedBodyExample?.id,
          items: bodyExamples,
        };
      }

      // Determine if request body is required
      const isBodyRequired = requestBody?.required === true;

      const request: ApiRequest = {
        id: generateId(),
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        url: `{{BASE_URL}}${normalizeOpenApiPathTemplate(path, pathParams)}`,
        headers: [
          ...(headers.length > 0 ? headers : []),
          ...(reqBodyMediaType && !headers.some((header) => header.key.toLowerCase() === "content-type")
            ? [{ key: "Content-Type", value: reqBodyMediaType, enabled: true }]
            : []),
        ],
        params,
        ...(pathParams.length > 0 ? { pathParams } : {}),
        body,
        bodyType: body ? "raw" : "none",
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
      });
    }
  }
  return requests;
}
