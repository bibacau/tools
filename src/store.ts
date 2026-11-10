import { uid } from "./utils";
import { nativeApp } from "./platform";
import { openDB } from "idb";
export type Item = {
  id: string;
  rev: number;
  data: Record<string, any>;
  dirty: boolean;
  version: string;
};
const db = openDB("personal-os", 1, {
  upgrade(db) {
    db.createObjectStore("records", { keyPath: "id" });
  },
});
let items: Item[] = [];
let listeners: (() => void)[] = [];
let syncing = false;
export let syncState = "Starting local storage";
export let lastSync = localStorage.getItem("lastSync") || "";
const notify = () => listeners.forEach((f) => f());
export const subscribe = (f: () => void) => {
  listeners.push(f);
  return () => {
    listeners = listeners.filter((x) => x !== f);
  };
};
export const all = () => items;
export const list = (type: string) =>
  items.filter((r) => r.data.type === type && !r.data.deleted);
export const get = (id: string) => items.find((r) => r.id === id)?.data;
export async function init() {
  items = await (await db).getAll("records");
  syncState = "Saved on this device";
  notify();
}
export async function put(id: string, data: Record<string, any>) {
  const old = items.find((r) => r.id === id);
  const row: Item = {
    id,
    rev: old?.rev || 0,
    data: { ...data, updated: Date.now() },
    dirty: true,
    version: uid(),
  };
  items = [...items.filter((r) => r.id !== id), row];
  notify();
  try {
    await (await db).put("records", row);
  } catch {
    syncState = "Storage failed · export a backup immediately";
    notify();
    return;
  }
  void sync();
}
export const create = (type: string, data: Record<string, any>) => {
  const id = uid();
  void put(id, { ...data, type });
  return id;
};
export const remove = (id: string) => put(id, { ...get(id), deleted: true });
export async function clearLocal() {
  await (await db).clear("records");
  items = [];
  localStorage.removeItem("authorized");
  notify();
}
export async function sync() {
  if (nativeApp) {
    syncState = "Saved on this device · standalone APK";
    notify();
    return;
  }
  if (syncing) return;
  syncing = true;
  try {
    const r = await fetch("/api/records");
    if (!r.ok)
      throw Error(r.status === 401 ? "Sign in to sync" : "Server unavailable");
    const remote: Item[] = await r.json();
    syncState = "Synchronizing";
    notify();
    for (const local of [...items].filter((x) => x.dirty)) {
      const response = await fetch(
        "/api/records/" + encodeURIComponent(local.id),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseRev: local.rev, data: local.data }),
        },
      );
      if (response.status === 409) {
        const { conflict } = await response.json();
        if (!conflict) throw Error("Sync conflict; retry");
        const copy = {
          ...local,
          id: uid(),
          rev: 0,
          version: uid(),
          data: {
            ...local.data,
            title:
              (local.data.title || local.data.name || "Record") +
              " (conflict copy)",
            conflictOf: local.id,
            ...(local.data.name
              ? { name: local.data.name + " (conflict copy)" }
              : {}),
          },
        };
        items.push(copy);
        await (await db).put("records", copy);
        const current = items.find((x) => x.id === local.id);
        if (current?.version === local.version) {
          const replacement = {
            ...conflict,
            dirty: false,
            version: uid(),
          };
          items = items.map((x) => (x.id === local.id ? replacement : x));
          await (await db).put("records", replacement);
        }
        syncState = "Conflict preserved as a separate copy";
      } else if (response.ok) {
        const { rev } = await response.json();
        const current = items.find((x) => x.id === local.id);
        if (current) {
          const row = {
            ...current,
            rev,
            dirty: current.version !== local.version,
          };
          items = items.map((x) => (x.id === row.id ? row : x));
          await (await db).put("records", row);
        }
      } else throw Error("Sync failed");
    }
    for (const remoteRow of remote) {
      const local = items.find((x) => x.id === remoteRow.id);
      if (!local || (!local.dirty && remoteRow.rev > local.rev)) {
        const row = {
          ...remoteRow,
          dirty: false,
          version: uid(),
        };
        items = [...items.filter((x) => x.id !== row.id), row];
        await (await db).put("records", row);
      }
    }
    lastSync = new Date().toISOString();
    localStorage.setItem("lastSync", lastSync);
    syncState = items.some((x) => x.dirty)
      ? "Changes pending · conflict copies preserved"
      : "All changes synced";
  } catch (e) {
    syncState = (e as Error).message + " · local changes saved";
  } finally {
    syncing = false;
    notify();
  }
}
export function backup() {
  return JSON.stringify(
    { format: "personal-os", version: 1, records: items },
    null,
    2,
  );
}
export async function restore(text: string) {
  const v = JSON.parse(text);
  if (
    v.format !== "personal-os" ||
    !Array.isArray(v.records) ||
    v.records.length > 20000
  )
    throw Error("Invalid Personal OS backup");
  for (const r of v.records) {
    if (typeof r.id !== "string" || !r.data || typeof r.data.type !== "string")
      throw Error("Invalid record");
  }
  for (const r of v.records)
    await put(
      r.id === "preferences" && !get("preferences") ? "preferences" : uid(),
      { ...r.data, importedFrom: r.id },
    );
}
