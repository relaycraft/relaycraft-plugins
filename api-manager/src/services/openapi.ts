import type { ApiRequest } from "../types";

export function parseOpenApi(spec: any, generateId: () => string): ApiRequest[] {
  const requests: ApiRequest[] = [];
  const paths = spec?.paths || {};
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of ["get", "post", "put", "delete", "patch", "head", "options"]) {
      const operation = (pathItem as any)?.[method];
      if (!operation) continue;
      const queryParams = (operation.parameters || [])
        .filter((p: any) => p.in === "query")
        .map((p: any) => `${p.name}={{${p.name}}}`)
        .join("&");
      const reqBody = operation.requestBody?.content?.["application/json"];
      const bodyExample = reqBody?.example ?? reqBody?.schema?.example;
      const body = bodyExample ? JSON.stringify(bodyExample, null, 2) : null;
      requests.push({
        id: generateId(),
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        url: `{{BASE_URL}}${path}${queryParams ? `?${queryParams}` : ""}`,
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        body,
        bodyType: body ? "raw" : "none",
        description: operation.description || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
  return requests;
}
