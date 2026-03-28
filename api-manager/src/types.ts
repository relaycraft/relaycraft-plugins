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

export type ApiRequest = {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: HeaderItem[];
  params?: ParamItem[];
  auth?: AuthConfig;
  body: string | null;
  bodyType: RequestBodyType;
  description?: string;
  postExtract?: PostExtractRule[];
  createdAt: number;
  updatedAt: number;
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
