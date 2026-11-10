import { useState, useRef, useEffect } from "react";
import * as store from "./store";
import { nativeApp } from "./platform";
import { raceStats, racePassages } from "./race-core";
type Player = {
  id: string;
  name: string;
  connected: boolean;
  progress: number;
  wpm: number;
  accuracy: number;
  finishedAt: number | null;
};
type Room = {
  code: string;
  host: string;
  phase: "lobby" | "racing" | "results";
  startAt: number;
  passage: string;
  players: Player[];
};
export default function TypingRace({ guest = false }: { guest?: boolean }) {
  const [mode, setMode] = useState<"solo" | "lan">(guest ? "lan" : "solo"),
    [name, setName] = useState("Player"),
    [difficulty, setDifficulty] = useState(50),
    [custom, setCustom] = useState(""),
    [code, setCode] = useState(
      new URLSearchParams(location.search).get("room") || "",
    ),
    [serverURL, setServerURL] = useState(""),
    [room, setRoom] = useState<Room | null>(null),
    [self, setSelf] = useState("me"),
    [typed, setTyped] = useState(""),
    [clock, setClock] = useState(0),
    [status, setStatus] = useState(""),
    [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null),
    offset = useRef(0),
    typedRef = useRef(""),
    roomRef = useRef<Room | null>(room),
    timer = useRef<ReturnType<typeof setInterval>>(undefined),
    saved = useRef(""),
    input = useRef<HTMLTextAreaElement>(null);
  roomRef.current = room;
  typedRef.current = typed;
  const passage = () =>
    custom.trim() ||
    racePassages[Math.floor(Math.random() * racePassages.length)];
  const send = (data: unknown) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setStatus("Connection is unavailable. Reconnect to create/join a room.");
      return;
    }
    socket.current.send(JSON.stringify(data));
  };
  useEffect(
    () => () => {
      socket.current?.close();
      clearInterval(timer.current);
    },
    [],
  );
  function solo() {
    const text = passage();
    if (text.length < 10 || text.length > 2000) {
      setStatus("Use a passage of 10–2000 characters.");
      return;
    }
    socket.current?.close();
    setConnected(false);
    setTyped("");
    setSelf("me");
    setStatus("");
    saved.current = "";
    setClock(performance.now());
    setRoom({
      code: "SOLO",
      host: "me",
      phase: "racing",
      startAt: performance.now() + 3000,
      passage: text,
      players: [
        {
          id: "me",
          name: name || "You",
          progress: 0,
          wpm: 0,
          accuracy: 100,
          connected: true,
          finishedAt: null,
        },
        {
          id: "computer",
          name: "Computer · " + difficulty + " WPM",
          progress: 0,
          wpm: difficulty,
          accuracy: 100,
          connected: true,
          finishedAt: null,
        },
      ],
    });
    setTimeout(() => input.current?.focus(), 50);
  }
  function connect(action: "create" | "join") {
    try {
      if (!name.trim()) throw Error("Enter your player name.");
      if (nativeApp && !serverURL)
        throw Error(
          "Enter the HTTPS address of your self-hosted server to join a room.",
        );
      const base = new URL(serverURL || location.origin);
      if (!["http:", "https:"].includes(base.protocol))
        throw Error("Use an HTTP/HTTPS server address.");
      const url =
        (base.protocol === "https:" ? "wss:" : "ws:") +
        "//" +
        base.host +
        "/api/races";
      socket.current?.close();
      const ws = new WebSocket(url);
      socket.current = ws;
      setStatus("Connecting to your server…");
      ws.onopen = () => {
        setConnected(true);
        setStatus("Connected to local server");
      };
      ws.onmessage = (e) => {
        try {
          const v = JSON.parse(e.data);
          if (v.type === "hello") {
            setSelf(v.id);
            offset.current = v.serverNow - Date.now();
            ws.send(JSON.stringify({ type: "ping", sent: Date.now() }));
            ws.send(JSON.stringify({ type: action, name, code }));
          }
          if (v.type === "pong" && Number.isFinite(v.sent))
            offset.current = v.serverNow - (Date.now() + v.sent) / 2;
          if (v.type === "state") {
            const old = roomRef.current;
            setRoom(v.room);
            setCode(v.room.code);
            if (v.room.startAt !== old?.startAt) {
              setTyped("");
              saved.current = "";
              input.current?.focus();
            }
            setClock(Date.now() + offset.current);
          }
          if (v.type === "error") setStatus(v.message);
        } catch {
          setStatus("Invalid server response");
        }
      };
      ws.onerror = () =>
        setStatus(
          "Unable to reach the race server. Use the self-hosted server address and check WebSocket/LAN access.",
        );
      ws.onclose = () => {
        if (socket.current === ws) {
          setConnected(false);
          setStatus(
            "Disconnected. The host must create/join a new room if this room expired.",
          );
        }
      };
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  useEffect(() => {
    if (!connected) return;
    const ping = setInterval(
      () => send({ type: "ping", sent: Date.now() }),
      5000,
    );
    return () => clearInterval(ping);
  }, [connected]);
  useEffect(() => {
    clearInterval(timer.current);
    if (!room || room.phase !== "racing") return;
    timer.current = setInterval(() => {
      const time =
        mode === "solo" ? performance.now() : Date.now() + offset.current;
      setClock(time);
      if (mode !== "solo") return;
      const current = roomRef.current;
      if (!current || current.phase !== "racing") return;
      const elapsed = Math.max(0, time - current.startAt),
        stats = raceStats(typedRef.current, current.passage, elapsed);
      const computerTime =
        (Array.from(current.passage).length / 5 / difficulty) * 60000;
      const players = current.players.map((p) =>
        p.id === "computer"
          ? {
              ...p,
              progress: Math.min(1, elapsed / computerTime),
              finishedAt:
                elapsed >= computerTime ? current.startAt + computerTime : null,
            }
          : p.finishedAt
            ? p
            : { ...p, ...stats, finishedAt: stats.complete ? time : null },
      );
      const finished = players.every((p) => p.finishedAt) || elapsed >= 120000;
      setRoom({ ...current, players, phase: finished ? "results" : "racing" });
    }, 50);
    return () => clearInterval(timer.current);
  }, [room?.startAt, room?.phase, mode, difficulty]);
  useEffect(() => {
    if (
      !room ||
      room.phase !== "results" ||
      guest ||
      saved.current === String(room.startAt)
    )
      return;
    saved.current = String(room.startAt);
    const player = room.players.find((p) => p.id === self);
    if (player)
      store.create("record", {
        name: "Typing race · " + (mode === "solo" ? "solo" : "friends"),
        tool: "wpm-race",
        value: Math.round(player.wpm) + " WPM",
        score: player.wpm,
        accuracy: player.accuracy,
        players: room.players.map((p) => ({
          name: p.name,
          wpm: p.wpm,
          accuracy: p.accuracy,
          finishedAt: p.finishedAt,
        })),
        passage: room.passage,
      });
  }, [room?.phase, self, guest]);
  const startLAN = () => {
    if (roomRef.current?.phase === "results") {
      send({ type: "reset" });
      return;
    }
    const text = passage();
    send({ type: "start", passage: text });
  };
  const start = () => (mode === "solo" ? solo() : startLAN());
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (mode === "solo") solo();
        else if (roomRef.current?.host === self) startLAN();
      }
      if (e.key === "Escape") input.current?.blur();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mode, custom, name, difficulty, self]);
  const countdown =
    room && room.phase === "racing"
      ? Math.max(0, Math.ceil((room.startAt - clock) / 1000))
      : 0;
  const me = room?.players.find((p) => p.id === self);
  const elapsed = room
    ? Math.max(0, (me?.finishedAt || clock) - room.startAt)
    : 0;
  const stats = room
    ? raceStats(typed, room.passage, elapsed)
    : { wpm: 0, accuracy: 100, progress: 0 };
  useEffect(() => {
    if (!countdown && room?.phase === "racing" && !me?.finishedAt)
      input.current?.focus();
  }, [countdown, room?.phase]);
  const standings = room
    ? [...room.players].sort((a, b) => {
        if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
        if (a.finishedAt) return -1;
        if (b.finishedAt) return 1;
        return b.progress - a.progress;
      })
    : [];
  return (
    <section className="panel race">
      <div className="section-heading">
        <h2>Find your rhythm. Race your friends.</h2>
        <span className="badge">
          {mode === "solo" ? "Offline solo" : "LAN / server connection"}
        </span>
      </div>
      {!guest && (
        <div className="filters">
          <button
            className={mode === "solo" ? "active" : ""}
            onClick={() => {
              socket.current?.close();
              setRoom(null);
              setMode("solo");
            }}
          >
            Solo race
          </button>
          <button
            className={mode === "lan" ? "active" : ""}
            onClick={() => {
              setRoom(null);
              setMode("lan");
            }}
          >
            Race with friends
          </button>
        </div>
      )}
      <div className="form-row">
        <label>
          Your name
          <input
            maxLength={30}
            value={name}
            disabled={room?.phase === "racing" || (mode === "lan" && !!room)}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {mode === "solo" && (
          <label>
            Computer pace · {difficulty} WPM
            <input
              type="range"
              min="10"
              max="180"
              value={difficulty}
              disabled={room?.phase === "racing"}
              onChange={(e) => setDifficulty(+e.target.value)}
            />
          </label>
        )}
      </div>
      {!guest && (!room || room.host === self || mode === "solo") && (
        <label>
          Custom passage (optional, 10–2000 characters)
          <textarea
            rows={3}
            maxLength={2000}
            disabled={room?.phase === "racing"}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Leave blank for a bundled random passage."
          />
        </label>
      )}
      {mode === "lan" && (
        <>
          <p className="subtle">
            The self-hosted server must be reachable. No internet is required on
            the same LAN. Share only the room code/invite; guests do not get
            access to your notes. Rooms expire after 30 minutes; races time out
            after 2 minutes. Guest progress is casual competition, not
            anti-cheat certified.
          </p>
          {nativeApp && (
            <label>
              Self-hosted server address
              <input
                placeholder="https://your-personal-os-server"
                value={serverURL}
                onChange={(e) => setServerURL(e.target.value)}
              />
            </label>
          )}
          <div className="actions">
            <label>
              Room code
              <input
                aria-label="Room code"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <button onClick={() => connect("join")}>Join room</button>
            {!guest && !nativeApp && (
              <button onClick={() => connect("create")}>Create room</button>
            )}
            <button
              disabled={!connected}
              onClick={() => {
                send({ type: "leave" });
                socket.current?.close();
                setRoom(null);
              }}
            >
              Leave room
            </button>
          </div>
          {room && (
            <p>
              Room <strong>{room.code}</strong> ·{" "}
              {room.players.filter((p) => p.connected).length}/8 players
              {!nativeApp && (
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(location.origin + "/race?room=" + room.code)
                      .then(() => setStatus("Invite copied"))
                      .catch(() =>
                        setStatus(
                          "Copy this invite: " +
                            location.origin +
                            "/race?room=" +
                            room.code,
                        ),
                      )
                  }
                >
                  Copy invite
                </button>
              )}
            </p>
          )}
        </>
      )}
      <div className="actions">
        <button
          className="primary"
          disabled={
            room?.phase === "racing" ||
            (mode === "lan" && (!connected || room?.host !== self))
          }
          onClick={start}
        >
          {room?.phase === "results" ? "Rematch" : "Start race"}
        </button>
        <small>
          Ctrl/⌘ + Enter starts/rematches · Escape releases typing focus · paste
          disabled
        </small>
      </div>
      <p role="status">{status}</p>
      {room && (
        <>
          <div className="race-countdown" role="status">
            {countdown
              ? `Starting in ${countdown}…`
              : room.phase === "lobby"
                ? "Waiting for host"
                : room.phase === "results"
                  ? "Race results"
                  : me?.finishedAt
                    ? "Finished! Waiting for the other racers…"
                    : "Go!"}
          </div>
          <div className="race-tracks">
            {room.players.map((p, i) => (
              <div className="race-track" key={p.id}>
                <div>
                  <b>
                    {p.name}
                    {p.id === self ? " (you)" : ""}
                  </b>
                  <span>
                    {p.connected ? Math.round(p.wpm) + " WPM" : "Disconnected"}{" "}
                    · {p.accuracy.toFixed(0)}%
                  </span>
                </div>
                <div className="race-road">
                  <div
                    className="race-car"
                    style={{
                      left: `${Math.min(100, Math.max(0, p.progress)) * 90}%`,
                      background: ["#9c8bff", "#70baa2", "#d8965e", "#7da6da"][
                        i % 4
                      ],
                    }}
                  >
                    ➜
                  </div>
                </div>
                <progress
                  aria-label={p.name + " progress"}
                  value={Math.min(1, p.progress)}
                  max="1"
                />
              </div>
            ))}
          </div>
          <div className="typing-passage race-passage">
            {[...room.passage].map((c, i) => (
              <span
                key={i}
                className={
                  i < Array.from(typed).length
                    ? Array.from(typed)[i] === c
                      ? "correct"
                      : "incorrect"
                    : i === Array.from(typed).length
                      ? "caret"
                      : ""
                }
              >
                {c}
              </span>
            ))}
          </div>
          <textarea
            ref={input}
            aria-label="Race typing input"
            placeholder={
              countdown
                ? "Wait for the countdown…"
                : "Type the passage exactly…"
            }
            value={typed}
            disabled={
              room.phase !== "racing" || countdown > 0 || !!me?.finishedAt
            }
            onPaste={(e) => e.preventDefault()}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            onChange={(e) => {
              setTyped(e.target.value);
              typedRef.current = e.target.value;
              if (mode === "lan")
                send({ type: "progress", typed: e.target.value });
            }}
          />
          <div className="stats-row">
            <div>
              <small>WPM</small>
              <b>{Math.round(stats.wpm)}</b>
            </div>
            <div>
              <small>ACCURACY</small>
              <b>{stats.accuracy.toFixed(1)}%</b>
            </div>
            <div>
              <small>PROGRESS</small>
              <b>{(stats.progress * 100).toFixed(0)}%</b>
            </div>
          </div>
          {room.phase === "results" && (
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Racer</th>
                  <th>WPM</th>
                  <th>Accuracy</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td>{Math.round(p.wpm)}</td>
                    <td>{p.accuracy.toFixed(1)}%</td>
                    <td>
                      {p.finishedAt
                        ? ((p.finishedAt - room.startAt) / 1000).toFixed(2) +
                          "s"
                        : "DNF"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {guest && (
        <p className="subtle">
          Race guest view only. Your room invite does not unlock any private
          Personal OS tools.
        </p>
      )}
    </section>
  );
}
