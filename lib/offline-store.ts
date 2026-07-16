import type { StoredHabit } from "./app-model.ts";

export type SyncOperation = {
  operationId: string;
  kind: "habit.create" | "habit.update" | "habit.delete" | "completion.add" | "completion.remove" | "purchase" | "invite.accept";
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  syncedAt?: string;
};

const DB_NAME = "rost-garden";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
      if (!db.objectStoreNames.contains("operations")) db.createObjectStore("operations", { keyPath: "operationId" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadHabitSnapshot(): Promise<StoredHabit[] | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  const value = await requestResult(db.transaction("snapshots", "readonly").objectStore("snapshots").get("habits"));
  db.close();
  return Array.isArray(value) ? value as StoredHabit[] : null;
}

export async function saveHabitSnapshot(habits: StoredHabit[]) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  await requestResult(db.transaction("snapshots", "readwrite").objectStore("snapshots").put(habits, "habits"));
  db.close();
}

export async function enqueueOperation(operation: SyncOperation) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  await requestResult(db.transaction("operations", "readwrite").objectStore("operations").put(operation));
  db.close();
}

export async function pendingOperations(): Promise<SyncOperation[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDatabase();
  const all = await requestResult(db.transaction("operations", "readonly").objectStore("operations").getAll());
  db.close();
  return all.filter((operation) => !operation.syncedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function markOperationSynced(operationId: string) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  const transaction = db.transaction("operations", "readwrite");
  const store = transaction.objectStore("operations");
  const operation = await requestResult(store.get(operationId)) as SyncOperation | undefined;
  if (operation) await requestResult(store.put({ ...operation, syncedAt: new Date().toISOString() }));
  db.close();
}

export function newOperation(kind: SyncOperation["kind"], entityId: string, payload: Record<string, unknown>): SyncOperation {
  return { operationId: crypto.randomUUID(), kind, entityId, payload, createdAt: new Date().toISOString(), attempts: 0 };
}

export function mergeOperations(local: SyncOperation[], remoteIds: Set<string>) {
  const unique = new Map<string, SyncOperation>();
  for (const operation of local) if (!remoteIds.has(operation.operationId)) unique.set(operation.operationId, operation);
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
