/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ApiCollection, CollectionMeta, Environment } from "../types";
import { normalizeRequestBodyType } from "../utils";
import { RequestHistoryService } from "./requestHistory";
import type { RequestHistoryAppendInput } from "./requestHistory";

export class ApiManagerStorage {
  private store: any;
  private requestHistory: RequestHistoryService;

  constructor(api: any) {
    this.store = api.storage;
    this.requestHistory = new RequestHistoryService(this.store);
  }

  async getEnvironments(): Promise<Environment[]> {
    const raw = await this.store.get("environments");
    return raw ? JSON.parse(raw) : [];
  }

  async saveEnvironments(envs: Environment[]) {
    await this.store.set("environments", JSON.stringify(envs));
  }

  async getGlobalVariables(): Promise<Record<string, string>> {
    const raw = await this.store.get("global_variables");
    return raw ? JSON.parse(raw) : {};
  }

  async saveGlobalVariables(variables: Record<string, string>) {
    await this.store.set("global_variables", JSON.stringify(variables || {}));
  }

  async getActiveEnvironmentId(): Promise<string> {
    const raw = await this.store.get("active_environment_id");
    return raw ? String(raw) : "none";
  }

  async saveActiveEnvironmentId(envId: string) {
    await this.store.set("active_environment_id", String(envId || "none"));
  }

  /**
   * Merged view: V2 metadata-only entries plus untouched legacy entries
   * (which keep their original snapshot/preview fields), newest first.
   */
  async getRequestHistory(): Promise<any[]> {
    return this.requestHistory.getMerged();
  }

  /**
   * Append one new-format metadata-only entry. The legacy `request_history`
   * key is never written here; V2 retention trims only `request_history_v2_*`
   * keys created by this feature.
   */
  async appendRequestHistory(entry: RequestHistoryAppendInput) {
    await this.requestHistory.append(entry);
    return this.requestHistory.getMerged();
  }

  /** Explicit per-item delete — applies to both legacy and V2 entries. */
  async deleteRequestHistoryItem(historyId: string) {
    await this.requestHistory.deleteById(historyId);
    return this.requestHistory.getMerged();
  }

  /** Explicit clear-all — removes V2 keys and empties the legacy array. */
  async clearRequestHistory() {
    await this.requestHistory.clearAll();
    return [];
  }

  /** Explicit clear for one request — applies to both legacy and V2 entries. */
  async clearRequestHistoryBySource(sourceRequestId: string) {
    await this.requestHistory.clearBySource(sourceRequestId);
    return this.requestHistory.getMerged();
  }

  async getIndex(): Promise<CollectionMeta[] | null> {
    const raw = await this.store.get("collections_index");
    return raw ? JSON.parse(raw) : null;
  }

  async saveIndex(index: CollectionMeta[]) {
    await this.store.set("collections_index", JSON.stringify(index));
  }

  async loadIndex() {
    const cached = await this.getIndex();
    if (cached !== null) return cached;
    const keys = await this.store.list("collection_");
    const metas = (
      await Promise.all(
        keys.map(async (key: string) => {
          const raw = await this.store.get(key);
          if (!raw) return null;
          const col: ApiCollection = JSON.parse(raw);
          return {
            id: col.id,
            name: col.name,
            description: col.description,
            requestCount:
              (col.requests || []).length +
              (col.folders || []).reduce((n, f) => n + (f.requests || []).length, 0),
            updatedAt: col.updatedAt,
          } satisfies CollectionMeta;
        }),
      )
    ).filter(Boolean) as CollectionMeta[];
    await this.saveIndex(metas);
    return metas;
  }

  async getCollection(id: string): Promise<ApiCollection | null> {
    const raw = await this.store.get(`collection_${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApiCollection;
    return {
      ...parsed,
      requests: (parsed.requests || []).map((request) => ({
        ...request,
        bodyType: normalizeRequestBodyType((request as any).bodyType),
      })),
      folders: (parsed.folders || []).map((folder) => ({
        ...folder,
        requests: (folder.requests || []).map((request) => ({
          ...request,
          bodyType: normalizeRequestBodyType((request as any).bodyType),
        })),
      })),
    };
  }

  async saveCollection(collection: ApiCollection) {
    const normalized = { ...collection, updatedAt: Date.now() };
    await this.store.set(`collection_${normalized.id}`, JSON.stringify(normalized));
    const index = await this.loadIndex();
    const nextMeta: CollectionMeta = {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description,
      requestCount:
        (normalized.requests || []).length +
        (normalized.folders || []).reduce((n, f) => n + (f.requests || []).length, 0),
      updatedAt: normalized.updatedAt,
    };
    const idx = index.findIndex((x) => x.id === normalized.id);
    if (idx >= 0) index[idx] = nextMeta;
    else index.push(nextMeta);
    await this.saveIndex(index);
  }

  async deleteCollection(id: string) {
    await this.store.delete(`collection_${id}`);
    const index = await this.loadIndex();
    await this.saveIndex(index.filter((x) => x.id !== id));
  }

  async getDefaultCollectionId(): Promise<string | null> {
    const raw = await this.store.get("default_collection_id");
    return raw ? String(raw) : null;
  }

  async saveDefaultCollectionId(id: string | null) {
    if (id === null) {
      await this.store.delete("default_collection_id");
    } else {
      await this.store.set("default_collection_id", String(id));
    }
  }

  async getActiveSession(): Promise<{ collectionId: string | null; requestId: string | null }> {
    const raw = await this.store.get("active_session");
    return raw ? JSON.parse(raw) : { collectionId: null, requestId: null };
  }

  async saveActiveSession(collectionId: string | null, requestId: string | null) {
    await this.store.set("active_session", JSON.stringify({ collectionId, requestId }));
  }
}
