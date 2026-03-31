import type { RequestBodyType } from "./utils";

export type HeaderItem = { key: string; value: string; enabled: boolean };
export type ParamItem = { key: string; value: string; enabled: boolean };

export type PostExtractRule = {
  variable: string;
  from: "body" | "header" | "status";
  path?: string;
  header?: string;
};

export type AuthConfig = {
  type: "none" | "bearer" | "basic" | "apikey";
  bearer?: string;
  basicUser?: string;
  basicPass?: string;
  apikeyKey?: string;
  apikeyValue?: string;
  apikeyLocation?: "header" | "query";
};

export type UnresolvedVariableSection = "url" | "params" | "headers" | "auth" | "body";

export type UnresolvedVariableInfo = {
  key: string;
  sections: UnresolvedVariableSection[];
};

export type UnresolvedVariableSummary = {
  hasMissing: boolean;
  missingKeys: string[];
  items: UnresolvedVariableInfo[];
  sectionCounts: Record<UnresolvedVariableSection, number>;
  sections: Record<UnresolvedVariableSection, string[]>;
};

export type ImportedExampleValue = {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  value: string;
  source: "example" | "examples" | "schema_example" | "schema_default" | "schema_generated";
  mediaType?: string;
};

export type ImportedRequestExamples = {
  body?: {
    selectedId?: string;
    items: ImportedExampleValue[];
  };
  params?: Record<
    string,
    {
      selectedId?: string;
      items: ImportedExampleValue[];
    }
  >;
  headers?: Record<
    string,
    {
      selectedId?: string;
      items: ImportedExampleValue[];
    }
  >;
};

export type PathParamMeta = {
  name: string;
  selectedExampleId?: string;
  examples?: ImportedExampleValue[];
};

export type ApiRequest = {
  id: string;
  name: string;
  mockRuleId?: string;
  method: string;
  url: string;
  headers: HeaderItem[];
  params?: ParamItem[];
  pathParams?: PathParamMeta[];
  auth?: AuthConfig;
  body: string | null;
  bodyType: RequestBodyType;
  description?: string;
  examples?: ImportedRequestExamples;
  postExtract?: PostExtractRule[];
  createdAt: number;
  updatedAt: number;
};

export type ImportedApiRequest = {
  request: ApiRequest;
  tag?: string | null;
};

export type ApiCollection = {
  id: string;
  name: string;
  description?: string;
  folders: Array<{ id: string; name: string; requests: ApiRequest[] }>;
  requests: ApiRequest[];
  createdAt: number;
  updatedAt: number;
};

export type CollectionMeta = {
  id: string;
  name: string;
  description?: string;
  requestCount: number;
  updatedAt: number;
};

export type Environment = {
  id: string;
  name: string;
  variables: Record<string, string>;
  isActive?: boolean;
};

export type RunnerResult = {
  requestId: string;
  name: string;
  method: string;
  status: number | null;
  time: number | null;
  error: string | null;
  state: "pending" | "running" | "done" | "error";
};
