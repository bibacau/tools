import { beforeEach, afterEach, it, expect, vi } from "vitest";
let platform: typeof import("../src/platform");
let values: Map<string, string>;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_NATIVE", "true");
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  platform = await import("../src/platform");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const post = (path: string, data: unknown) =>
  platform.appFetch(path, { method: "POST", body: JSON.stringify(data) });
it("creates a local account without making any server request or storing a raw password", async () => {
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  expect(await (await platform.appFetch("/api/auth")).json()).toEqual({
    setup: true,
    authenticated: false,
  });
  expect((await post("/api/auth", { password: "short7" })).status).toBe(400);
  expect((await post("/api/auth", { password: "Forest88" })).ok).toBe(true);
  expect(values.get("native-account")).not.toContain("Forest88");
  expect(network).not.toHaveBeenCalled();
});
it("locks, rejects wrong passwords and unlocks the same local account", async () => {
  await post("/api/auth", { password: "Forest88" });
  await post("/api/logout", {});
  expect((await post("/api/auth", { password: "Wrong888" })).status).toBe(401);
  expect((await post("/api/auth", { password: "Forest88" })).ok).toBe(true);
});
it("changes the local password only with a correct current password", async () => {
  await post("/api/auth", { password: "Forest88" });
  expect(
    (
      await post("/api/password", {
        currentPassword: "wrong",
        newPassword: "Forest99",
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await post("/api/password", {
        currentPassword: "Forest88",
        newPassword: "Forest99",
      })
    ).ok,
  ).toBe(true);
  await post("/api/logout", {});
  expect((await post("/api/auth", { password: "Forest88" })).status).toBe(401);
  expect((await post("/api/auth", { password: "Forest99" })).ok).toBe(true);
});
it("does not pretend that server sync or speech recognition is available", async () => {
  expect((await platform.appFetch("/api/records")).status).toBe(503);
  expect(
    (await (await platform.appFetch("/api/speech")).json()).available,
  ).toBe(false);
});
