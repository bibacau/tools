import { it, expect } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { attachRaces } from "../server/races.js";
it("hosts LAN rooms, synchronizes starts, validates progress, ranks finishers and permits rematches", async () => {
  const server = createServer();
  let time = Date.now();
  const seen: any[] = [];
  const _rooms = attachRaces(server, {
    authorize: async (req: any) => req.headers.cookie === "owner=yes",
    now: () => time,
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port,
    origin = "http://127.0.0.1:" + port;
  const sockets: WebSocket[] = [];
  function open(owner = false) {
    const ws = new WebSocket("ws://127.0.0.1:" + port + "/api/races", {
      origin,
      headers: owner ? { Cookie: "owner=yes" } : {},
    });
    sockets.push(ws);
    ws.on("message", (raw) => seen.push(JSON.parse(raw.toString())));
    return ws;
  }
  function message(ws: WebSocket, filter: (v: any) => boolean) {
    return new Promise<any>((resolve, reject) => {
      const t = setTimeout(
        () =>
          reject(
            Error("Room message timeout: " + JSON.stringify(seen.slice(-3))),
          ),
        4000,
      );
      const listener = (raw: any) => {
        const v = JSON.parse(raw.toString());
        if (filter(v)) {
          clearTimeout(t);
          ws.off("message", listener);
          resolve(v);
        }
      };
      ws.on("message", listener);
    });
  }
  try {
    const owner = open(true),
      guest = open();
    await Promise.all([
      message(owner, (v) => v.type === "hello"),
      message(guest, (v) => v.type === "hello"),
    ]);
    let next = message(owner, (v) => v.type === "state");
    owner.send(JSON.stringify({ type: "create", name: "Host" }));
    const first = await next;
    expect(first.room.code).toHaveLength(12);
    const code = first.room.code;
    next = message(guest, (v) => v.type === "state");
    guest.send(JSON.stringify({ type: "join", code, name: "Friend" }));
    expect((await next).room.players).toHaveLength(2);
    let error = message(guest, (v) => v.type === "error");
    guest.send(JSON.stringify({ type: "start", passage: "hello race" }));
    expect((await error).message).toContain("host");
    const startOwner = message(
        owner,
        (v) => v.type === "state" && v.room.phase === "racing",
      ),
      startGuest = message(
        guest,
        (v) => v.type === "state" && v.room.phase === "racing",
      );
    owner.send(JSON.stringify({ type: "start", passage: "hello race" }));
    const [a, b] = await Promise.all([startOwner, startGuest]);
    expect(a.room.startAt).toBe(b.room.startAt);
    time = a.room.startAt + 1000;
    next = message(
      owner,
      (v) =>
        v.type === "state" &&
        v.room.players.some((p: any) => p.name === "Host" && p.finishedAt),
    );
    owner.send(JSON.stringify({ type: "progress", typed: "hello race" }));
    await next;
    next = message(
      owner,
      (v) => v.type === "state" && v.room.phase === "results",
    );
    guest.send(JSON.stringify({ type: "progress", typed: "hello race" }));
    const result = await next;
    expect(result.room.players.every((p: any) => p.progress === 1)).toBe(true);
    expect(result.room.players.every((p: any) => p.accuracy === 100)).toBe(
      true,
    );
    next = message(
      owner,
      (v) => v.type === "state" && v.room.phase === "racing",
    );
    const lobby = message(
      owner,
      (v) => v.type === "state" && v.room.phase === "lobby",
    );
    owner.send(JSON.stringify({ type: "reset" }));
    expect((await lobby).room.players.every((p: any) => p.progress === 0)).toBe(
      true,
    );
    owner.send(JSON.stringify({ type: "start", passage: "another race" }));
    expect((await next).room.players.every((p: any) => p.progress === 0)).toBe(
      true,
    );
    error = message(guest, (v) => v.type === "error");
    guest.send(
      JSON.stringify({ type: "join", code: "BADCODE", name: "Friend" }),
    );
    expect((await error).message).toContain("Room not found");
  } finally {
    for (const s of sockets) s.terminate();
    await new Promise<void>((r) => server.close(() => r()));
  }
}, 15000);
