import { appFetch, nativeApp } from "./platform";
import DOMPurify from "dompurify";
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  ArrowRightLeft,
  Play,
  RotateCcw,
  Mic,
  Square,
  Pause,
  Pin,
} from "lucide-react";
import QRCode from "qrcode";
import * as store from "./store";
import {
  download,
  copy,
  weightedIndex,
  typingStats,
  cps,
  dataURLToBlob,
} from "./utils";
import { units, convert, volumeMass, densities } from "./units";
const ImageTools = lazy(() => import("./image-tools"));
const URLCleaner = lazy(() => import("./url-cleaner"));
const Whiteboard = lazy(() => import("./whiteboard"));
const Playground = lazy(() => import("./playground"));
const TypingRace = lazy(() => import("./typing-race"));
const Graph = lazy(() => import("./graph"));
const record = (name: string, value: string, extra: any = {}) =>
  store.create("record", { name, value, ...extra });
function Import({
  accept = ".json",
  onLoad,
}: {
  accept?: string;
  onLoad: (s: string) => void;
}) {
  return (
    <label className="file-button">
      Import
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void f
              .text()
              .then(onLoad)
              .catch((e) => alert(e.message));
          e.target.value = "";
        }}
      />
    </label>
  );
}
function Notes() {
  const rows = store.list("note"),
    [id, setId] = useState(rows[0]?.id || ""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("date");
  const n = store.get(id);
  const edit = (v: any) => void store.put(id, { ...n, ...v });
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editor.current) {
      const safe = DOMPurify.sanitize(n?.body || "");
      if (editor.current.innerHTML !== safe) editor.current.innerHTML = safe;
    }
  }, [id, n?.body]);
  const add = () =>
    setId(
      store.create("note", {
        title: "Untitled note",
        body: "",
        folder: "",
        tags: "",
      }),
    );
  return (
    <div className="notes-layout">
      <div className="panel note-list">
        <button className="primary" onClick={add}>
          <Plus size={16} />
          New note
        </button>
        <input
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="date">Last edited</option>
          <option value="title">Title</option>
        </select>
        {rows
          .filter((r) =>
            (
              r.data.title +
              " " +
              r.data.body +
              " " +
              r.data.tags +
              " " +
              r.data.folder
            )
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .sort(
            (a, b) =>
              Number(!!b.data.pinned) - Number(!!a.data.pinned) ||
              (sort === "title"
                ? a.data.title.localeCompare(b.data.title)
                : b.data.updated - a.data.updated),
          )
          .map((r) => (
            <button
              className={"note-link " + (id === r.id ? "active" : "")}
              key={r.id}
              onClick={() => setId(r.id)}
            >
              <b>
                {r.data.pinned ? "⌖ " : ""}
                {r.data.title || "Untitled"}
              </b>
              <small>
                {r.data.folder || "No folder"} ·{" "}
                {new Date(r.data.updated).toLocaleDateString()}
              </small>
            </button>
          ))}
        <Import
          accept=".md,.txt"
          onLoad={(text) =>
            setId(
              store.create("note", {
                title: "Imported note",
                body: escapeHTML(text).replace(/\n/g, "<br>"),
                folder: "",
                tags: "",
              }),
            )
          }
        />
      </div>
      {n && !n.deleted ? (
        <div className="panel editor">
          <div className="actions">
            <button title="Pin" onClick={() => edit({ pinned: !n.pinned })}>
              <Pin size={15} />
              {n.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={() =>
                setId(
                  store.create("note", { ...n, title: n.title + " (copy)" }),
                )
              }
            >
              <Copy size={15} />
              Duplicate
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this note?")) {
                  void store.remove(id);
                  setId("");
                }
              }}
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={() =>
                download(n.title + ".txt", editor.current?.innerText || "")
              }
            >
              TXT
            </button>
            <button
              onClick={() =>
                download(n.title + ".md", htmlToMarkdown(n.body || ""))
              }
            >
              Markdown
            </button>
          </div>
          <input
            className="note-title"
            aria-label="Note title"
            value={n.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
          <div className="form-row">
            <label>
              Folder
              <input
                value={n.folder || ""}
                onChange={(e) => edit({ folder: e.target.value })}
                placeholder="Personal"
              />
            </label>
            <label>
              Tags
              <input
                value={n.tags || ""}
                onChange={(e) => edit({ tags: e.target.value })}
                placeholder="ideas, life"
              />
            </label>
          </div>
          <div className="editor-toolbar">
            {[
              ["B", "bold"],
              ["I", "italic"],
              ["H2", "formatBlock", "h2"],
              ["List", "insertUnorderedList"],
              ["Code", "formatBlock", "pre"],
            ].map(([label, cmd, arg]) => (
              <button
                key={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  document.execCommand(cmd, false, arg);
                  edit({ body: editor.current?.innerHTML });
                }}
              >
                {label}
              </button>
            ))}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const url = prompt("Link URL (https://…)");
                if (url && /^https?:\/\//i.test(url)) {
                  document.execCommand("createLink", false, url);
                  edit({ body: editor.current?.innerHTML });
                }
              }}
            >
              Link
            </button>
          </div>
          <div
            ref={editor}
            className="rich-editor"
            contentEditable
            role="textbox"
            aria-label="Note body"
            suppressContentEditableWarning
            onPaste={(e) => {
              e.preventDefault();
              document.execCommand(
                "insertText",
                false,
                e.clipboardData.getData("text/plain"),
              );
            }}
            onInput={(e) => edit({ body: e.currentTarget.innerHTML })}
          />
          <small className="subtle">
            Saved automatically on this device · {store.syncState}
          </small>
        </div>
      ) : (
        <div className="panel empty">
          <h2>Room for a new thought.</h2>
          <p>Create a note or choose one to keep writing.</p>
          <button onClick={add}>Create note</button>
        </div>
      )}
    </div>
  );
}
function escapeHTML(v: string) {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function htmlToMarkdown(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return n.textContent || "";
    const e = n as HTMLElement,
      inner = [...n.childNodes].map(walk).join("");
    switch (e.tagName) {
      case "B":
      case "STRONG":
        return "**" + inner + "**";
      case "I":
      case "EM":
        return "*" + inner + "*";
      case "H1":
        return "\n# " + inner + "\n";
      case "H2":
        return "\n## " + inner + "\n";
      case "LI":
        return "\n- " + inner;
      case "PRE":
        return "\n```\n" + inner + "\n```\n";
      case "A":
        return "[" + inner + "](" + e.getAttribute("href") + ")";
      case "BR":
        return "\n";
      case "DIV":
      case "P":
        return inner + "\n";
      default:
        return inner;
    }
  };
  return walk(doc.body);
}
function QR() {
  const [type, setType] = useState("Text"),
    [text, setText] = useState("https://example.com"),
    [ssid, setSsid] = useState(""),
    [pass, setPass] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [size, setSize] = useState(512),
    [fg, setFg] = useState("#111827"),
    [bg, setBg] = useState("#ffffff"),
    [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M"),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const esc = (v: string) => v.replace(/([\\;,:])/g, "\\$1");
  const value =
    type === "Wi-Fi"
      ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(pass)};;`
      : type === "Contact"
        ? `BEGIN:VCARD\nVERSION:3.0\nFN:${name.replace(/[\r\n]/g, "")}\nEMAIL:${email.replace(/[\r\n]/g, "")}\nTEL:${phone.replace(/[\r\n]/g, "")}\nEND:VCARD`
        : text;
  const options = {
    width: size,
    color: { dark: fg, light: bg },
    errorCorrectionLevel: level,
    margin: 3,
  };
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value || " ", options)
      .then((v) => {
        if (active) {
          setUrl(v);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [value, size, fg, bg, level]);
  const save = () => store.create("qr", { title: type, value });
  return (
    <div className="split">
      <section className="panel">
        <h2>Make a connection.</h2>
        <label>
          Content type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {["Text", "URL", "Wi-Fi", "Contact"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {["Text", "URL"].includes(type) ? (
          <label>
            Content
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        ) : type === "Wi-Fi" ? (
          <>
            <label>
              Network name
              <input value={ssid} onChange={(e) => setSsid(e.target.value)} />
            </label>
            <label>
              Password
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            {[
              ["Name", name, setName],
              ["Email", email, setEmail],
              ["Phone", phone, setPhone],
            ].map(([l, v, s]: any) => (
              <label key={l}>
                {l}
                <input value={v} onChange={(e) => s(e.target.value)} />
              </label>
            ))}
          </>
        )}
        <div className="form-row">
          <label>
            Size
            <select value={size} onChange={(e) => setSize(+e.target.value)}>
              {[256, 512, 1024, 2048].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Error correction
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
            >
              {["L", "M", "Q", "H"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Foreground
            <input
              type="color"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
            />
          </label>
        </div>
        <small className="subtle">
          Wi-Fi passwords are included in the code. Recent history is only saved
          when you export.
        </small>
      </section>
      <section className="panel qr-preview">
        {url && <img src={url} alt="Generated QR code" />}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button
            onClick={async () => {
              download("qr.png", dataURLToBlob(url));
              save();
            }}
          >
            PNG <Download size={15} />
          </button>
          <button
            onClick={async () => {
              download(
                "qr.svg",
                await QRCode.toString(value, { ...options, type: "svg" }),
                "image/svg+xml",
              );
              save();
            }}
          >
            SVG <Download size={15} />
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({
                    "image/png": dataURLToBlob(url),
                  }),
                ]);
              } catch {
                alert(
                  "Image copying is unavailable in this browser. Use PNG export.",
                );
              }
            }}
          >
            Copy image
          </button>
        </div>
        <small>Generated right here. Never uploaded.</small>
      </section>
      <section className="panel">
        <h2>Recent QR codes</h2>
        {store
          .list("qr")
          .slice(-8)
          .reverse()
          .map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setType("Text");
                setText(r.data.value);
              }}
            >
              {r.data.title} · {r.data.value.slice(0, 40)}
            </button>
          ))}
      </section>
    </div>
  );
}
function Units() {
  const [cat, setCat] = useState("Length"),
    [from, setFrom] = useState("m"),
    [to, setTo] = useState("ft"),
    [n, setN] = useState("1"),
    [precision, setPrecision] = useState(6),
    [significant, setSignificant] = useState(false),
    [material, setMaterial] = useState("Water"),
    [density, setDensity] = useState(998.2),
    [search, setSearch] = useState("");
  const special = cat === "Volume → mass";
  const change = (c: string) => {
    setCat(c);
    setFrom(Object.keys(units[c] || units.Volume)[0]);
    setTo(
      Object.keys(special ? units.Mass : units[c] || units.Mass)[1] || "kg",
    );
    if (c === "Volume → mass") {
      setFrom("L");
      setTo("kg");
    }
  };
  const result = special
    ? volumeMass(+n, from, to, density)
    : convert(+n, cat, from, to);
  const resultText = Number.isFinite(result)
    ? significant
      ? result.toPrecision(precision)
      : String(+result.toFixed(precision))
    : "—";
  const selector = (
    v: string,
    set: (v: string) => void,
    defs: Record<string, number>,
  ) => (
    <select value={v} onChange={(e) => set(e.target.value)}>
      {Object.keys(defs)
        .filter(
          (x) => x === v || x.toLowerCase().includes(search.toLowerCase()),
        )
        .map((x) => (
          <option key={x}>{x}</option>
        ))}
    </select>
  );
  return (
    <div className="panel converter">
      <div className="section-heading">
        <h2>Every measure, made simple.</h2>
        <span className="badge">100% offline</span>
      </div>
      <label>
        Category
        <select
          aria-label="Category"
          value={cat}
          onChange={(e) => change(e.target.value)}
        >
          {[...Object.keys(units), "Volume → mass"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <input
        placeholder="Filter unit names…"
        aria-label="Filter units"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="conversion-row">
        <label>
          From
          <input
            type="number"
            value={n}
            onChange={(e) => setN(e.target.value)}
          />
          {selector(from, setFrom, special ? units.Volume : units[cat])}
        </label>
        <button
          aria-label="Swap units"
          disabled={special}
          onClick={() => {
            setFrom(to);
            setTo(from);
            setN(String(result));
          }}
        >
          <ArrowRightLeft />
        </button>
        <label>
          To<output>{resultText}</output>
          {selector(to, setTo, special ? units.Mass : units[cat])}
        </label>
      </div>
      {special && (
        <>
          <div className="form-row">
            <label>
              Material
              <select
                aria-label="Material"
                value={material}
                onChange={(e) => {
                  setMaterial(e.target.value);
                  if (densities[e.target.value])
                    setDensity(densities[e.target.value]);
                }}
              >
                {[...Object.keys(densities), "Custom"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Density (kg/m³)
              <input
                type="number"
                min="0"
                value={density}
                onChange={(e) => {
                  setMaterial("Custom");
                  setDensity(+e.target.value);
                }}
              />
            </label>
          </div>
          <p className="subtle">
            Mass = density × volume. Presets are approximate at about 20°C;
            composition and temperature affect density.
          </p>
        </>
      )}
      <div className="form-row">
        <label>
          Precision
          <input
            type="number"
            min="1"
            max="12"
            value={precision}
            onChange={(e) =>
              setPrecision(Math.max(1, Math.min(12, +e.target.value)))
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={significant}
            onChange={(e) => setSignificant(e.target.checked)}
          />
          Significant digits
        </label>
      </div>
      <div className="actions">
        <button onClick={() => copy(resultText)}>Copy result</button>
        <button
          onClick={() =>
            store.create("conversion", { cat, from, to, n, material, density })
          }
        >
          Favorite conversion
        </button>
      </div>
      <div className="chips">
        {store.list("conversion").map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setCat(r.data.cat);
              setFrom(r.data.from);
              setTo(r.data.to);
              setN(r.data.n);
              setDensity(r.data.density);
              setMaterial(r.data.material);
            }}
          >
            {r.data.from} → {r.data.to}
          </button>
        ))}
      </div>
    </div>
  );
}
const wheelColors = [
  "#9c8bff",
  "#68c6b1",
  "#efbd70",
  "#ee8d9f",
  "#7aa9ea",
  "#c89be3",
];
function WheelCard({
  row,
  spinSignal,
}: {
  row: store.Item;
  spinSignal: number;
}) {
  const w = row.data,
    [spinning, setSpinning] = useState(false),
    [angle, setAngle] = useState(0),
    [winner, setWinner] = useState(""),
    [error, setError] = useState(""),
    [sound, setSound] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const update = (v: any) => void store.put(row.id, { ...w, ...v });
  const entries: any[] = w.entries || [];
  const total = entries.reduce((s, e) => s + Math.max(0, +e.weight), 0);
  let pos = 0;
  const gradient = entries
    .map((e, i) => {
      const start = pos;
      pos += (Math.max(0, +e.weight) / total) * 100;
      return `${e.color || wheelColors[i % 6]} ${start}% ${pos}%`;
    })
    .join(",");
  const spin = () => {
    if (spinning) return;
    try {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      const i = weightedIndex(
        entries.map((e) => +e.weight),
        bytes[0] / 4294967296,
      );
      const start =
        (entries.slice(0, i).reduce((s, e) => s + Math.max(0, +e.weight), 0) /
          total) *
        360;
      const center = start + (Math.max(0, +entries[i].weight) / total) * 180;
      const target = (360 - center) % 360;
      setAngle((a) => a + 1800 + ((target - (a % 360) + 360) % 360));
      setSpinning(true);
      setWinner("");
      setError("");
      timeout.current = setTimeout(() => {
        setWinner(entries[i].label);
        record(w.name, entries[i].label, { tool: "wheel", wheelId: row.id });
        setSpinning(false);
        if (sound) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          osc.onended = () => void ctx.close();
        }
        if (w.removeWinner)
          update({ entries: entries.filter((_, j) => j !== i) });
      }, 3500);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (spinSignal) spin();
  }, [spinSignal]);
  return (
    <section className="panel wheel-card">
      <div className="actions">
        <input
          aria-label="Wheel name"
          value={w.name}
          disabled={spinning}
          onChange={(e) => update({ name: e.target.value })}
        />
        <button
          disabled={spinning}
          title="Duplicate wheel"
          onClick={() =>
            store.create("wheel", { ...w, name: w.name + " copy" })
          }
        >
          <Copy size={15} />
        </button>
        <button
          title="Delete wheel"
          disabled={spinning}
          onClick={() => {
            if (confirm("Delete wheel?")) void store.remove(row.id);
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="wheel-stage">
        <div className="wheel-pointer" />
        <div
          className="wheel"
          style={{
            background: total ? `conic-gradient(${gradient})` : "#333",
            transform: `rotate(${angle}deg)`,
          }}
        >
          {entries.map((e, i) => {
            const before =
              (entries
                .slice(0, i)
                .reduce((s, x) => s + Math.max(0, +x.weight), 0) /
                total) *
              360;
            const mid = before + (Math.max(0, +e.weight) / total) * 180;
            return (
              <span
                key={i}
                style={{
                  transform: `rotate(${mid}deg) translateY(-86px) rotate(-90deg)`,
                }}
              >
                {e.label}
              </span>
            );
          })}
          <div className="wheel-hub">✦</div>
        </div>
      </div>
      <button
        className="primary full"
        disabled={spinning || !total}
        onClick={spin}
      >
        {spinning ? "A little suspense…" : "Give it a spin"} <Play size={16} />
      </button>
      {winner && (
        <div className="winner" role="status">
          The wheel chose <b>{winner}</b>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="entry-head">
        <small>ENTRY</small>
        <small>WEIGHT / COLOR</small>
      </div>
      {entries.map((e, i) => (
        <div className="wheel-entry" key={i}>
          <input
            aria-label={"Entry " + (i + 1)}
            disabled={spinning}
            value={e.label}
            onChange={(ev) =>
              update({
                entries: entries.map((x, j) =>
                  j === i ? { ...x, label: ev.target.value } : x,
                ),
              })
            }
          />
          <input
            aria-label={"Weight " + (i + 1)}
            type="number"
            min="0"
            disabled={spinning}
            value={e.weight}
            onChange={(ev) =>
              update({
                entries: entries.map((x, j) =>
                  j === i ? { ...x, weight: Math.max(0, +ev.target.value) } : x,
                ),
              })
            }
          />
          <input
            aria-label={"Color " + (i + 1)}
            type="color"
            disabled={spinning}
            value={e.color || wheelColors[i % 6]}
            onChange={(ev) =>
              update({
                entries: entries.map((x, j) =>
                  j === i ? { ...x, color: ev.target.value } : x,
                ),
              })
            }
          />
          <button
            aria-label={"Remove entry " + (i + 1)}
            disabled={spinning}
            onClick={() =>
              update({ entries: entries.filter((_, j) => j !== i) })
            }
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        className="text-button"
        disabled={spinning}
        onClick={() =>
          update({
            entries: [
              ...entries,
              {
                label: "New entry",
                weight: 1,
                color: wheelColors[entries.length % 6],
              },
            ],
          })
        }
      >
        <Plus size={15} /> Add entry
      </button>
      <label className="check">
        <input
          type="checkbox"
          checked={!!w.removeWinner}
          onChange={(e) => update({ removeWinner: e.target.checked })}
        />
        Remove winner after spin
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => setSound(e.target.checked)}
        />
        Play result sound
      </label>
      <button
        onClick={() =>
          download(w.name + ".json", JSON.stringify({ name: w.name, entries }))
        }
      >
        Export wheel
      </button>
    </section>
  );
}
function Wheels() {
  const [signal, setSignal] = useState(0);
  const add = () =>
    store.create("wheel", {
      name: "A little decision",
      entries: ["Yes", "No", "Maybe", "Try again"].map((label, i) => ({
        label,
        weight: 1,
        color: wheelColors[i],
      })),
    });
  return (
    <>
      <div className="actions tool-actions">
        <button className="primary" onClick={add}>
          <Plus size={16} />
          New wheel
        </button>
        <button onClick={() => setSignal((x) => x + 1)}>Spin all wheels</button>
        <Import
          onLoad={(s) => {
            try {
              const v = JSON.parse(s);
              if (
                !Array.isArray(v.entries) ||
                !v.entries.length ||
                v.entries.some(
                  (e: any) =>
                    typeof e.label !== "string" ||
                    !Number.isFinite(e.weight) ||
                    e.weight < 0,
                )
              )
                throw Error();
              store.create("wheel", {
                name: String(v.name || "Imported wheel"),
                entries: v.entries,
              });
            } catch {
              alert("Invalid wheel file");
            }
          }}
        />
      </div>
      <div className="wheel-grid">
        {store.list("wheel").map((r) => (
          <WheelCard key={r.id} row={r} spinSignal={signal} />
        ))}
        {!store.list("wheel").length && (
          <div className="panel empty">
            <h2>A good place to leave it to chance.</h2>
            <p>
              Create your first wheel, add a few choices, and let it decide.
            </p>
            <button onClick={add}>Create a wheel</button>
          </div>
        )}
      </div>
    </>
  );
}
function Reaction() {
  const [state, setState] = useState("idle"),
    [value, setValue] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined),
    start = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  function click() {
    if (state === "waiting") {
      clearTimeout(timer.current);
      setState("early");
    } else if (state === "go") {
      const ms = performance.now() - start.current;
      setValue(ms);
      setState("result");
      record("Reaction time", Math.round(ms) + " ms", {
        tool: "reaction",
        score: ms,
      });
    } else {
      setState("waiting");
      timer.current = setTimeout(
        () => {
          start.current = performance.now();
          setState("go");
        },
        1500 + Math.random() * 3500,
      );
    }
  }
  const scores = store
    .list("record")
    .filter((r) => r.data.tool === "reaction")
    .map((r) => r.data.score);
  return (
    <section className="panel">
      <button
        className={"test-area reaction " + state}
        onPointerDown={click}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            click();
          }
        }}
      >
        {state === "waiting" ? (
          <>
            <span>•••</span>
            <h2>Wait for green…</h2>
            <p>Patience is part of the game.</p>
          </>
        ) : state === "go" ? (
          <>
            <h2>Now!</h2>
            <p>Click or tap.</p>
          </>
        ) : state === "early" ? (
          <>
            <h2>A little too eager.</h2>
            <p>Click to try again.</p>
          </>
        ) : state === "result" ? (
          <>
            <strong>
              {Math.round(value)}
              <small>ms</small>
            </strong>
            <p>Nice reflexes. Click for another round.</p>
          </>
        ) : (
          <>
            <Play size={34} />
            <h2>Ready when you are.</h2>
            <p>Click to start. Wait for green, then react.</p>
          </>
        )}
      </button>
      <div className="stats-row">
        <div>
          <small>ATTEMPTS</small>
          <b>{scores.length}</b>
        </div>
        <div>
          <small>BEST</small>
          <b>{scores.length ? Math.round(Math.min(...scores)) + " ms" : "—"}</b>
        </div>
        <div>
          <small>AVERAGE</small>
          <b>
            {scores.length
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) +
                " ms"
              : "—"}
          </b>
        </div>
        <div>
          <small>WORST</small>
          <b>{scores.length ? Math.round(Math.max(...scores)) + " ms" : "—"}</b>
        </div>
      </div>
      <p className="subtle">
        Measured with performance.now(). Display, browser, touch and
        input-device latency affect results; this is a practice tool, not a
        clinical measurement.
      </p>
    </section>
  );
}
function CPS() {
  const [duration, setDuration] = useState(5),
    [count, setCount] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [running, setRunning] = useState(false),
    [done, setDone] = useState(false);
  const start = useRef(0),
    clicks = useRef(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const sec = (performance.now() - start.current) / 1000;
      setElapsed(Math.min(sec, duration));
      if (sec >= duration) {
        setRunning(false);
        setDone(true);
        record(
          "CPS · " + duration + "s",
          cps(clicks.current, duration).toFixed(2) + " CPS",
          { tool: "cps", score: cps(clicks.current, duration), duration },
        );
      }
    }, 16);
    return () => clearInterval(t);
  }, [running, duration]);
  const reset = () => {
    setRunning(false);
    setDone(false);
    setCount(0);
    setElapsed(0);
    clicks.current = 0;
  };
  const click = () => {
    if (done) return;
    if (!running) {
      start.current = performance.now();
      setRunning(true);
    }
    if (running && performance.now() - start.current >= duration * 1000) return;
    clicks.current++;
    setCount(clicks.current);
  };
  const best = Math.max(
    0,
    ...store
      .list("record")
      .filter((r) => r.data.tool === "cps" && r.data.duration === duration)
      .map((r) => r.data.score),
  );
  return (
    <section className="panel">
      <div className="actions">
        {[1, 5, 10, 30, 60].map((s) => (
          <button
            className={duration === s ? "active" : ""}
            disabled={running}
            key={s}
            onClick={() => {
              setDuration(s);
              reset();
            }}
          >
            {s}s
          </button>
        ))}
        <button onClick={reset}>
          <RotateCcw size={15} />
          Reset
        </button>
      </div>
      <button
        className="test-area"
        onPointerDown={click}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            click();
          }
        }}
      >
        <strong>{count}</strong>
        <h2>
          {done
            ? cps(count, duration).toFixed(2) + " clicks per second"
            : running
              ? "Keep your rhythm."
              : "Every click counts."}
        </h2>
        <p>{done ? "Reset to go again." : "Click or tap here to begin."}</p>
      </button>
      <div className="stats-row">
        <div>
          <small>TIME LEFT</small>
          <b>{(duration - elapsed).toFixed(1)}s</b>
        </div>
        <div>
          <small>LIVE CPS</small>
          <b>{elapsed ? cps(count, elapsed).toFixed(2) : "0.00"}</b>
        </div>
        <div>
          <small>PERSONAL BEST · {duration}s</small>
          <b>{best.toFixed(2)}</b>
        </div>
      </div>
    </section>
  );
}
const passages = [
  "The quiet moments between busy days are where our best ideas often begin. Take a breath, find your rhythm, and let the words flow from your thoughts to the page. Small steps can lead to wonderful places.",
  "A window opens to a garden full of sunlight. The leaves move gently in the breeze while a small bird sings from the old tree. There is something beautiful about the simple things we notice when we slow down.",
  "Good tools make room for the things that matter. A notebook for a thought, a little chance for a decision, and a clear space to begin again. Every day is another opportunity to make something useful and kind.",
];
function WPM() {
  const [mode, setMode] = useState("test");
  return (
    <>
      <div className="filters">
        <button
          className={mode === "test" ? "active" : ""}
          onClick={() => setMode("test")}
        >
          Typing test
        </button>
        <button
          className={mode === "race" ? "active" : ""}
          onClick={() => setMode("race")}
        >
          Typing race
        </button>
      </div>
      {mode === "test" ? (
        <TypingTest />
      ) : (
        <Suspense fallback={<div className="panel">Opening race…</div>}>
          <TypingRace />
        </Suspense>
      )}
    </>
  );
}
function TypingTest() {
  const [duration, setDuration] = useState(30),
    [target, setTarget] = useState(() =>
      passages[Math.floor(Math.random() * passages.length)].repeat(12),
    ),
    [typed, setTyped] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [running, setRunning] = useState(false),
    [done, setDone] = useState(false);
  const started = useRef(0),
    typedRef = useRef("");
  const reset = () => {
    setRunning(false);
    setDone(false);
    setTyped("");
    typedRef.current = "";
    setElapsed(0);
    setTarget(passages[Math.floor(Math.random() * passages.length)].repeat(12));
  };
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const s = Math.min(
        duration,
        (performance.now() - started.current) / 1000,
      );
      setElapsed(s);
      if (s >= duration) {
        setRunning(false);
        setDone(true);
        const stats = typingStats(typedRef.current, target, duration);
        record("Typing · " + duration + "s", Math.round(stats.wpm) + " WPM", {
          tool: "wpm",
          score: stats.wpm,
          duration,
          ...stats,
        });
      }
    }, 40);
    return () => clearInterval(t);
  }, [running, duration, target]);
  const stats = typingStats(typed, target, elapsed);
  return (
    <section className="panel">
      <div className="actions">
        {[15, 30, 60, 120].map((s) => (
          <button
            key={s}
            className={duration === s ? "active" : ""}
            disabled={running}
            onClick={() => {
              setDuration(s);
              reset();
            }}
          >
            {s}s
          </button>
        ))}
        <button onClick={reset}>
          Restart <RotateCcw size={15} />
        </button>
      </div>
      <div className="typing-passage" aria-hidden="true">
        {[...target.slice(0, Math.max(250, typed.length + 100))].map((c, i) => (
          <span
            key={i}
            className={
              i < typed.length
                ? typed[i] === c
                  ? "correct"
                  : "incorrect"
                : i === typed.length
                  ? "caret"
                  : ""
            }
          >
            {c}
          </span>
        ))}
      </div>
      <textarea
        className="typing-input"
        aria-label="Typing test input"
        placeholder="Start typing to begin…"
        value={typed}
        disabled={done}
        onPaste={(e) => e.preventDefault()}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        onKeyDown={(e) => {
          if (e.key === "Escape") reset();
        }}
        onChange={(e) => {
          if (running && performance.now() - started.current >= duration * 1000)
            return;
          if (!running) {
            started.current = performance.now();
            setRunning(true);
          }
          setTyped(e.target.value);
          typedRef.current = e.target.value;
        }}
      />
      <div className="stats-row">
        {[
          ["TIME LEFT", (duration - elapsed).toFixed(0) + "s"],
          ["WPM", Math.round(stats.wpm)],
          ["RAW WPM", Math.round(stats.raw)],
          ["ACCURACY", stats.accuracy.toFixed(1) + "%"],
          ["ERRORS", stats.errors],
        ].map(([l, v]) => (
          <div key={l}>
            <small>{l}</small>
            <b>{v}</b>
          </div>
        ))}
      </div>
      {done && <h2>That's your rhythm. {Math.round(stats.wpm)} WPM.</h2>}
      <p className="subtle">
        WPM = correct characters ÷ 5 ÷ minutes. Raw WPM uses all typed
        characters; accuracy is matching characters ÷ typed characters. Escape
        restarts. Paste is disabled.
      </p>
      <p>
        Personal best ({duration}s):{" "}
        {Math.round(
          Math.max(
            0,
            ...store
              .list("record")
              .filter(
                (r) => r.data.tool === "wpm" && r.data.duration === duration,
              )
              .map((r) => r.data.score),
          ),
        )}{" "}
        WPM
      </p>
    </section>
  );
}
function Speech() {
  const [text, setText] = useState(""),
    [status, setStatus] = useState("Ready"),
    [active, setActive] = useState(false),
    [paused, setPaused] = useState(false),
    [available, setAvailable] = useState(false),
    [lang, setLang] = useState("en"),
    [permission, setPermission] = useState("Not requested");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null);
  useEffect(() => {
    appFetch("/api/speech")
      .then((r) => r.json())
      .then((v) => setAvailable(v.available))
      .catch(() => {});
    return () => {
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function start() {
    try {
      if (!window.isSecureContext)
        throw Error("Microphone requires HTTPS or localhost.");
      if (!available)
        throw Error(
          "Start the optional local speech service and install its model first.",
        );
      if (!navigator.mediaDevices || !window.MediaRecorder)
        throw Error("Recording is unsupported in this browser.");
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setPermission("Granted");
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      let bytes = 0;
      r.ondataavailable = (e) => {
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > 23 * 1024 * 1024) {
          r.stop();
          setStatus("Recording size limit reached. Processing…");
        }
      };
      r.onstop = async () => {
        setActive(false);
        setPaused(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        setStatus("Transcribing on your local server…");
        try {
          const form = new FormData();
          form.append(
            "audio",
            new Blob(chunks, { type: r.mimeType }),
            "recording.webm",
          );
          const response = await appFetch("/api/speech", {
            method: "POST",
            body: form,
          });
          const v = await response.json();
          if (!response.ok) throw Error(v.error);
          setText((t) => t + (t ? "\n" : "") + v.text);
          store.create("transcript", { text: v.text, language: lang });
          setStatus("Transcription saved locally");
        } catch (e) {
          setStatus((e as Error).message);
        }
      };
      r.start(1000);
      setActive(true);
      setStatus(
        "Recording · audio goes only to your local server when stopped",
      );
    } catch (e) {
      if ((e as Error).name === "NotAllowedError") setPermission("Denied");
      setStatus((e as Error).message);
    }
  }
  return (
    <div className="panel">
      <div className="section-heading">
        <h2>A place for your spoken thoughts.</h2>
        <span className="badge">
          {nativeApp
            ? "Transcription editor · server unavailable"
            : "Local server recognition"}
        </span>
      </div>
      <p className="subtle">
        Uses an optional Vosk service with an installed model. No cloud speech
        service and no model downloads during use. The local server must be
        reachable. English baseline; choose a matching installed model for
        another language.
      </p>
      <label>
        Installed model language
        <select
          value={lang}
          disabled={active}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="en">English (default model)</option>
          <option value="custom">Other (install matching model)</option>
        </select>
      </label>
      <p>
        Microphone permission: {permission} · Local recognizer:{" "}
        {available ? "available" : "not running"}
      </p>
      <div className="actions">
        <button
          className="primary"
          disabled={active || !available}
          onClick={start}
        >
          <Mic size={16} />
          Start recording
        </button>
        <button
          disabled={!active}
          onClick={() => {
            const r = recorder.current;
            if (!r) return;
            if (paused) r.resume();
            else r.pause();
            setPaused(!paused);
            setStatus(paused ? "Recording" : "Paused");
          }}
        >
          <Pause size={16} />
          {paused ? "Resume" : "Pause"}
        </button>
        <button disabled={!active} onClick={() => recorder.current?.stop()}>
          <Square size={16} />
          Stop & transcribe
        </button>
      </div>
      <p role="status">{status}</p>
      <textarea
        rows={12}
        aria-label="Transcription"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your words will appear here. You can also write or edit a transcript."
      />
      <div className="actions">
        <button onClick={() => copy(text)}>Copy</button>
        <button onClick={() => download("transcript.txt", text)}>
          Download TXT
        </button>
        <button
          onClick={() => {
            store.create("note", {
              title: "Voice note",
              body: escapeHTML(text).replace(/\n/g, "<br>"),
              tags: "transcript",
              folder: "",
            });
            setStatus("Saved to Notes");
          }}
        >
          Save to Notes
        </button>
        <button onClick={() => setText("")}>Clear</button>
      </div>
      <h3>Transcription history</h3>
      {store
        .list("transcript")
        .reverse()
        .map((r) => (
          <div className="activity-row" key={r.id}>
            <button onClick={() => setText(r.data.text)}>
              {r.data.text.slice(0, 80)}…
            </button>
            <small>{new Date(r.data.updated).toLocaleString()}</small>
            <button onClick={() => store.remove(r.id)}>Delete</button>
          </div>
        ))}
    </div>
  );
}
export default function Tools({ id }: { id: string; prefs: any }) {
  switch (id) {
    case "whiteboard":
      return (
        <Suspense fallback={<div className="panel">Opening whiteboard…</div>}>
          <Whiteboard />
        </Suspense>
      );
    case "playground":
      return (
        <Suspense fallback={<div className="panel">Opening code editor…</div>}>
          <Playground />
        </Suspense>
      );
    case "image-converter":
    case "background-remover":
      return (
        <Suspense
          fallback={<div className="panel">Opening image workspace…</div>}
        >
          <ImageTools key={id} mode={id} />
        </Suspense>
      );
    case "url-cleaner":
      return (
        <Suspense fallback={<div className="panel">Opening URL cleaner…</div>}>
          <URLCleaner />
        </Suspense>
      );
    case "notes":
      return <Notes />;
    case "qr":
      return <QR />;
    case "units":
      return <Units />;
    case "graph":
      return (
        <Suspense fallback={<div className="panel">Loading graph engine…</div>}>
          <Graph />
        </Suspense>
      );
    case "wheel":
      return <Wheels />;
    case "reaction":
      return <Reaction />;
    case "cps":
      return <CPS />;
    case "wpm":
      return <WPM />;
    case "speech":
      return <Speech />;
    default:
      return null;
  }
}
