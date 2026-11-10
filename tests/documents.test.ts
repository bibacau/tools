import { it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock("../src/store", () => ({
  all: () => state.rows,
  put: (id: string, data: any) => {
    state.rows = state.rows.map((r) =>
      r.id === id ? { id, data, version: "saved" } : r,
    );
  },
  create: (type: string, data: any) => {
    state.rows.push({ id: "copy", version: "new", data: { ...data, type } });
    return "copy";
  },
}));
import { saveDocument } from "../src/documents";
it("forks an open editor draft if server synchronization replaced its loaded revision", () => {
  state.rows = [
    { id: "board", version: "remote", data: { name: "Remote board" } },
  ];
  const result = saveDocument(
    "board",
    { type: "whiteboard", name: "Local board", content: { draft: true } },
    "loaded",
  );
  expect(result.conflict).toBe(true);
  expect(state.rows[0].data.name).toBe("Remote board");
  expect(state.rows[1].data).toMatchObject({
    name: "Local board (conflict copy)",
    conflictOf: "board",
    content: { draft: true },
  });
  expect(
    saveDocument("copy", { type: "whiteboard", name: "Edited copy" }, "new")
      .conflict,
  ).toBe(false);
});
