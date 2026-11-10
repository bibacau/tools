import { WebSocketServer, WebSocket } from "ws";
import { randomBytes, randomUUID } from "node:crypto";
export function attachRaces(server, { authorize, now = Date.now } = {}) {
  const rooms = new Map(),
    wss = new WebSocketServer({ noServer: true, maxPayload: 12000 });
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };
  function state(room) {
    return {
      code: room.code,
      host: room.host,
      phase: room.phase,
      startAt: room.startAt,
      passage: room.passage,
      serverNow: now(),
      players: [...room.players.values()].map(({ ws: _ws, ...p }) => p),
    };
  }
  const broadcast = (room) => {
    const data = { type: "state", room: state(room) };
    for (const p of room.players.values()) send(p.ws, data);
  };
  function finish(room) {
    room.phase = "results";
    broadcast(room);
  }
  function detach(ws) {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const p = room.players.get(ws.playerId);
    if (p) {
      p.connected = false;
      if (room.phase === "lobby") room.players.delete(p.id);
    }
    if (room.host === ws.playerId) {
      room.host =
        [...room.players.values()].find((p) => p.connected && p.owner)?.id ||
        "";
    }
    if (![...room.players.values()].some((p) => p.connected)) {
      rooms.delete(room.code);
    } else broadcast(room);
    ws.roomCode = "";
  }
  server.on("upgrade", async (req, socket, head) => {
    try {
      if (new URL(req.url, "http://local").pathname !== "/api/races") {
        socket.destroy();
        return;
      }
      const origin = req.headers.origin;
      const same = origin && new URL(origin).host === req.headers.host;
      if (!same && origin !== "https://localhost") {
        socket.destroy();
        return;
      }
      const owner = same && (await authorize(req));
      if (wss.clients.size >= 300) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.owner = !!owner;
        wss.emit("connection", ws);
      });
    } catch {
      socket.destroy();
    }
  });
  wss.on("connection", (ws) => {
    ws.playerId = randomUUID();
    ws.rate = { at: now(), count: 0 };
    send(ws, {
      type: "hello",
      id: ws.playerId,
      owner: ws.owner,
      serverNow: now(),
    });
    ws.on("message", (raw) => {
      try {
        if (now() - ws.rate.at > 1000) ws.rate = { at: now(), count: 0 };
        if (++ws.rate.count > 45) {
          ws.close(1008, "Too many messages");
          return;
        }
        const m = JSON.parse(raw.toString());
        if (m.type === "ping") {
          send(ws, { type: "pong", sent: m.sent, serverNow: now() });
          return;
        }
        if (m.type === "leave") {
          detach(ws);
          return;
        }
        if (m.type === "create" || m.type === "join") {
          if (
            typeof m.name !== "string" ||
            !m.name.trim() ||
            m.name.length > 30
          )
            throw Error("Use a player name of 1–30 characters.");
          let room;
          if (m.type === "create") {
            if (!ws.owner)
              throw Error(
                "Sign in on the self-hosted website to create a room.",
              );
            if (rooms.size >= 100)
              throw Error("Too many rooms; try again later.");
            const code = randomBytes(6).toString("hex").toUpperCase();
            room = {
              code,
              host: ws.playerId,
              phase: "lobby",
              passage: "",
              players: new Map(),
              created: now(),
              startAt: 0,
            };
            rooms.set(code, room);
          } else {
            room = rooms.get(String(m.code).toUpperCase());
            if (!room) throw Error("Room not found or expired.");
            if (room.phase !== "lobby")
              throw Error(
                "This race has already started. Ask the host to return to the lobby after it finishes.",
              );
            if (
              [...room.players.values()].filter((p) => p.connected).length >= 8
            )
              throw Error("Room is full (8 players).");
          }
          detach(ws);
          ws.roomCode = room.code;
          room.players.set(ws.playerId, {
            ws,
            id: ws.playerId,
            name: m.name.trim(),
            owner: ws.owner,
            connected: true,
            progress: 0,
            wpm: 0,
            accuracy: 100,
            finishedAt: null,
          });
          broadcast(room);
          return;
        }
        const room = rooms.get(ws.roomCode);
        if (!room) throw Error("Create or join a room first.");
        const player = room.players.get(ws.playerId);
        if (m.type === "reset") {
          if (room.host !== ws.playerId || room.phase !== "results")
            throw Error("Only the host can reset a completed race.");
          room.phase = "lobby";
          room.startAt = 0;
          for (const [id, p] of room.players) {
            if (!p.connected) {
              room.players.delete(id);
              continue;
            }
            Object.assign(p, {
              progress: 0,
              wpm: 0,
              accuracy: 100,
              finishedAt: null,
            });
          }
          broadcast(room);
          return;
        }
        if (m.type === "start") {
          if (room.host !== ws.playerId)
            throw Error("Only the room host can start or rematch.");
          if (!["lobby", "results"].includes(room.phase))
            throw Error("Race is already running.");
          if (
            typeof m.passage !== "string" ||
            m.passage.trim().length < 10 ||
            m.passage.length > 2000
          )
            throw Error("Passage must contain 10–2000 characters.");
          room.passage = m.passage.trim();
          room.startAt = now() + 3000;
          room.phase = "racing";
          for (const [id, p] of room.players) {
            if (!p.connected) {
              room.players.delete(id);
              continue;
            }
            Object.assign(p, {
              progress: 0,
              wpm: 0,
              accuracy: 100,
              finishedAt: null,
            });
          }
          broadcast(room);
          return;
        }
        if (m.type === "progress") {
          if (
            room.phase !== "racing" ||
            now() < room.startAt ||
            player.finishedAt
          )
            return;
          if (
            typeof m.typed !== "string" ||
            m.typed.length > room.passage.length + 100
          )
            throw Error("Invalid typing progress.");
          const typedChars = Array.from(m.typed),
            passageChars = Array.from(room.passage);
          let prefix = 0,
            correct = 0;
          for (let i = 0; i < typedChars.length; i++) {
            if (typedChars[i] === passageChars[i]) correct++;
          }
          while (
            prefix < typedChars.length &&
            typedChars[prefix] === passageChars[prefix]
          )
            prefix++;
          const elapsed = Math.max(1, now() - room.startAt);
          Object.assign(player, {
            progress: prefix / passageChars.length,
            wpm: correct / 5 / (elapsed / 60000),
            accuracy: typedChars.length
              ? (correct / typedChars.length) * 100
              : 100,
          });
          if (m.typed === room.passage) player.finishedAt = now();
          if (
            [...room.players.values()].every(
              (p) => !p.connected || p.finishedAt,
            )
          )
            finish(room);
          else broadcast(room);
        }
      } catch (error) {
        send(ws, {
          type: "error",
          message: error.message || "Invalid room request.",
        });
      }
    });
    ws.on("close", () => detach(ws));
    ws.on("error", () => {});
  });
  const interval = setInterval(() => {
    for (const room of rooms.values()) {
      if (now() - room.created > 30 * 60000) {
        for (const p of room.players.values()) p.ws.close(1000, "Room expired");
        rooms.delete(room.code);
      } else if (room.phase === "racing" && now() - room.startAt > 120000)
        finish(room);
    }
  }, 1000);
  interval.unref();
  server.on("close", () => {
    clearInterval(interval);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
  return { rooms, wss };
}
