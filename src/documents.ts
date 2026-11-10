import * as store from "./store";
/** An editor keeps its loaded version so background sync cannot silently replace its draft. */
export function saveDocument(
  id: string,
  data: Record<string, any>,
  loadedVersion?: string,
) {
  const existing = store.all().find((r) => r.id === id);
  let target = id,
    conflict = false;
  if (existing && loadedVersion && existing.version !== loadedVersion) {
    target = store.create(data.type, {
      ...data,
      name: (data.name || "Document") + " (conflict copy)",
      conflictOf: id,
    });
    conflict = true;
  } else void store.put(id, data);
  return {
    id: target,
    version: store.all().find((r) => r.id === target)?.version,
    conflict,
  };
}
