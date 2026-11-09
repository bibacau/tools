import { useState, useRef } from "react";
import { Plus, Download, Save, RotateCcw } from "lucide-react";
import { expression } from "./math";
import * as store from "./store";
import { download } from "./utils";
const colors = ["#a595ff", "#65d1b9", "#f1b567", "#f28caa", "#6caafa"];
export default function Graph() {
  const [equations, setEquations] = useState([
      { text: "sin(x)", color: colors[0] },
      { text: "x^2 / 10", color: colors[1] },
    ]),
    [range, setRange] = useState({ xmin: -10, xmax: 10, ymin: -5, ymax: 5 }),
    [grid, setGrid] = useState(true),
    [axes, setAxes] = useState(true),
    [name, setName] = useState("My graph"),
    [point, setPoint] = useState(0);
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<{ x: number; y: number; range: typeof range } | null>(null);
  const width = 900,
    height = 480;
  const sx = (x: number) =>
      ((x - range.xmin) / (range.xmax - range.xmin)) * width,
    sy = (y: number) =>
      height - ((y - range.ymin) / (range.ymax - range.ymin)) * height;
  const parsed = equations.map((e) => {
    try {
      return { ...e, fn: expression(e.text), error: "" };
    } catch (err) {
      return { ...e, fn: (_: number) => null, error: (err as Error).message };
    }
  });
  const zoom = (factor: number) =>
    setRange((r) => {
      const x = (r.xmin + r.xmax) / 2,
        y = (r.ymin + r.ymax) / 2,
        dx = ((r.xmax - r.xmin) * factor) / 2,
        dy = ((r.ymax - r.ymin) * factor) / 2;
      return { xmin: x - dx, xmax: x + dx, ymin: y - dy, ymax: y + dy };
    });
  return (
    <div className="panel">
      <div className="actions">
        <input
          aria-label="Graph name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() =>
            store.create("graph", { name, equations, range, grid, axes })
          }
        >
          <Save size={16} />
          Save graph
        </button>
        <button
          onClick={() => {
            if (!svg.current) return;
            const img = new Image(),
              url = URL.createObjectURL(
                new Blob([new XMLSerializer().serializeToString(svg.current)], {
                  type: "image/svg+xml",
                }),
              );
            img.onload = () => {
              const c = document.createElement("canvas");
              c.width = width;
              c.height = height;
              const ctx = c.getContext("2d")!;
              ctx.fillStyle = "#151923";
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0);
              c.toBlob((b) => b && download(name + ".png", b));
              URL.revokeObjectURL(url);
            };
            img.src = url;
          }}
        >
          <Download size={16} />
          PNG
        </button>
      </div>
      <div className="graph-layout">
        <div>
          {parsed.map((e, i) => (
            <div key={i} className="equation">
              <div className="actions">
                <input
                  type="color"
                  aria-label="Equation color"
                  value={e.color}
                  onChange={(ev) =>
                    setEquations((v) =>
                      v.map((x, j) =>
                        j === i ? { ...x, color: ev.target.value } : x,
                      ),
                    )
                  }
                />
                <span>y =</span>
                <input
                  aria-label={"Equation " + (i + 1)}
                  value={e.text}
                  onChange={(ev) =>
                    setEquations((v) =>
                      v.map((x, j) =>
                        j === i ? { ...x, text: ev.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  aria-label="Remove equation"
                  onClick={() =>
                    setEquations((v) => v.filter((_, j) => j !== i))
                  }
                >
                  ×
                </button>
              </div>
              {e.error && <small className="error">{e.error}</small>}
            </div>
          ))}
          <button
            onClick={() =>
              setEquations((v) => [
                ...v,
                { text: "x", color: colors[v.length % 5] },
              ])
            }
          >
            <Plus size={15} />
            Equation
          </button>
          <p className="subtle">
            Try x^2, sin(x), sqrt(x), log(x), exp(x). Trigonometry uses radians.
          </p>
          <div className="range-grid">
            {Object.entries(range).map(([k, v]) => (
              <label key={k}>
                {k}
                <input
                  type="number"
                  value={v}
                  onChange={(e) => {
                    const next = { ...range, [k]: +e.target.value };
                    if (next.xmin < next.xmax && next.ymin < next.ymax)
                      setRange(next);
                  }}
                />
              </label>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={grid}
              onChange={(e) => setGrid(e.target.checked)}
            />
            Grid
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={axes}
              onChange={(e) => setAxes(e.target.checked)}
            />
            Axes
          </label>
        </div>
        <div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            ref={svg}
            viewBox={`0 0 ${width} ${height}`}
            className="graph-svg"
            aria-label="Interactive mathematical graph"
            onWheel={(e) => zoom(e.deltaY > 0 ? 1.1 : 0.9)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, range };
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const rect = e.currentTarget.getBoundingClientRect(),
                dx =
                  ((e.clientX - d.x) / rect.width) *
                  (d.range.xmax - d.range.xmin),
                dy =
                  ((e.clientY - d.y) / rect.height) *
                  (d.range.ymax - d.range.ymin);
              setRange({
                xmin: d.range.xmin - dx,
                xmax: d.range.xmax - dx,
                ymin: d.range.ymin + dy,
                ymax: d.range.ymax + dy,
              });
            }}
          >
            <defs>
              <clipPath id="graphclip">
                <rect width={width} height={height} />
              </clipPath>
            </defs>
            <rect width={width} height={height} fill="#151923" />
            {grid &&
              Array.from({ length: 21 }, (_, i) => (
                <g key={i} stroke="#29303e" strokeWidth="1">
                  <line
                    x1={(i * width) / 20}
                    x2={(i * width) / 20}
                    y1="0"
                    y2={height}
                  />
                  <line
                    x1="0"
                    x2={width}
                    y1={(i * height) / 20}
                    y2={(i * height) / 20}
                  />
                </g>
              ))}
            {axes && (
              <g stroke="#7f8b9f">
                <line x1={sx(0)} x2={sx(0)} y1="0" y2={height} />
                <line x1="0" x2={width} y1={sy(0)} y2={sy(0)} />
                <text x="12" y="24" fill="#adb6c8" stroke="none">
                  x: {range.xmin.toFixed(1)} … {range.xmax.toFixed(1)} · y:{" "}
                  {range.ymin.toFixed(1)} … {range.ymax.toFixed(1)}
                </text>
              </g>
            )}
            <g clipPath="url(#graphclip)">
              {parsed.map((e, i) => {
                let path = "",
                  last: number | null = null;
                for (let j = 0; j <= 900; j++) {
                  const x = range.xmin + (j / 900) * (range.xmax - range.xmin);
                  let y: null | number = null;
                  try {
                    y = e.fn(x);
                  } catch {}
                  if (y === null || Math.abs(sy(y)) > height * 10) {
                    last = null;
                    continue;
                  }
                  const yy = sy(y);
                  path +=
                    (last === null || Math.abs(yy - last) > height
                      ? "M"
                      : "L") +
                    sx(x).toFixed(2) +
                    "," +
                    yy.toFixed(2);
                  last = yy;
                }
                let y = null;
                try {
                  y = e.fn(point);
                } catch {}
                return (
                  <g key={i}>
                    <path
                      d={path}
                      fill="none"
                      stroke={e.color}
                      strokeWidth="2.5"
                    />
                    {y !== null && (
                      <circle cx={sx(point)} cy={sy(y)} r="5" fill={e.color} />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="actions">
            <button onClick={() => zoom(0.8)}>Zoom +</button>
            <button onClick={() => zoom(1.25)}>Zoom −</button>
            <button
              onClick={() =>
                setRange({ xmin: -10, xmax: 10, ymin: -5, ymax: 5 })
              }
            >
              <RotateCcw size={14} />
              Reset view
            </button>
          </div>
        </div>
      </div>
      <h3>Coordinate table</h3>
      <label>
        Sample X
        <input
          type="number"
          value={point}
          onChange={(e) => setPoint(+e.target.value)}
        />
      </label>
      <table>
        <thead>
          <tr>
            <th>Equation</th>
            {[-1, 0, 1].map((d) => (
              <th key={d}>x = {point + d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.map((e, i) => (
            <tr key={i}>
              <td>{e.text}</td>
              {[-1, 0, 1].map((d) => {
                let y;
                try {
                  y = e.fn(point + d);
                } catch {}
                return <td key={d}>{y?.toPrecision(6) || "undefined"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Saved graphs</h3>
      <div className="chips">
        {store.list("graph").map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setEquations(r.data.equations);
              setRange(r.data.range);
              setName(r.data.name);
              setGrid(r.data.grid);
              setAxes(r.data.axes);
            }}
          >
            {r.data.name}
            <span
              role="button"
              aria-label="Delete saved graph"
              onClick={(e) => {
                e.stopPropagation();
                void store.remove(r.id);
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
