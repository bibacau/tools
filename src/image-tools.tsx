import { useState, useRef, useEffect } from "react";
import { Upload, Download, Trash2, Scissors } from "lucide-react";
import {
  formats,
  bytes,
  decodeImage,
  convertImage,
  solidBackground,
  extension,
  type Format,
} from "./image-utils";
import { download } from "./utils";
import * as store from "./store";
type Row = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  error?: string;
  output?: Blob;
  outputURL?: string;
  name?: string;
  busy?: boolean;
  settings?: string;
};
export default function ImageTools({ mode }: { mode: string }) {
  const removal = mode === "background-remover";
  const [rows, setRows] = useState<Row[]>([]),
    [format, setFormat] = useState<Format>("image/png"),
    [quality, setQuality] = useState(0.9),
    [background, setBackground] = useState("#ffffff"),
    [solid, setSolid] = useState(false),
    [progress, setProgress] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const cancel = useRef<((error: Error) => void) | null>(null);
  const urls = useRef(new Set<string>()),
    worker = useRef<Worker | null>(null),
    alive = useRef(true),
    rowsRef = useRef(rows);
  rowsRef.current = rows;
  const makeURL = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const revoke = (url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancel.current?.(Error("Cancelled"));
      worker.current?.terminate();
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, []);
  const settings = JSON.stringify({ format, quality, background });
  function update(id: string, values: Partial<Row>) {
    if (alive.current)
      setRows((v) => v.map((r) => (r.id === id ? { ...r, ...values } : r)));
  }
  async function add(files: FileList | File[]) {
    setStatus("");
    if (rowsRef.current.length + files.length > 20) {
      setStatus("Choose at most 20 files at once.");
      return;
    }
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      try {
        const image = await decodeImage(file),
          width = image.width,
          height = image.height;
        image.close();
        if (alive.current)
          setRows((v) => [
            ...v,
            { id, file, url: makeURL(file), width, height },
          ]);
      } catch (e) {
        if (alive.current)
          setRows((v) => [
            ...v,
            {
              id,
              file,
              url: "",
              width: 0,
              height: 0,
              error: (e as Error).message,
            },
          ]);
      }
    }
  }
  async function convert() {
    setBusy(true);
    setStatus("");
    for (const row of rows) {
      if (!row.width) continue;
      update(row.id, { busy: true, error: "" });
      try {
        const result = await convertImage(
          row.file,
          format,
          quality,
          background,
        );
        if (!alive.current) return;
        revoke(row.outputURL);
        update(row.id, {
          output: result.blob,
          outputURL: makeURL(result.blob),
          name: row.file.name.replace(/\.[^.]+$/, "") + "." + extension(format),
          settings,
          busy: false,
        });
      } catch (e) {
        update(row.id, { busy: false, error: (e as Error).message });
      }
    }
    if (alive.current) setBusy(false);
  }
  async function remove(row: Row) {
    setBusy(true);
    setStatus("");
    setProgress("Preparing image…");
    update(row.id, { busy: true, error: "" });
    try {
      const prepared = await convertImage(
        row.file,
        "image/png",
        1,
        "transparent",
        2048,
      );
      if (!alive.current) return;
      if (Math.max(row.width, row.height) > 2048)
        setStatus(
          "Large image resized to a 2048 px longest edge for background removal.",
        );
      const w = new Worker(new URL("./background.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      const blob = await new Promise<Blob>((resolve, reject) => {
        cancel.current = reject;
        w.onmessage = (e) => {
          if (e.data.error) reject(Error(e.data.error));
          else if (e.data.blob) resolve(e.data.blob);
          else
            setProgress(
              e.data.stage.startsWith("fetch:")
                ? `Downloading model/runtime · ${e.data.progress ?? 0}% of current resource`
                : "Removing background…",
            );
        };
        w.onerror = () =>
          reject(
            Error(
              "Recognition worker could not run. Check browser WebAssembly support, available memory and network/model access.",
            ),
          );
        w.postMessage({
          file: prepared.blob,
          allowDownload: !!store.get("preferences")?.external,
        });
      });
      if (!alive.current) return;
      revoke(row.outputURL);
      update(row.id, {
        output: blob,
        outputURL: makeURL(blob),
        name: row.file.name.replace(/\.[^.]+$/, "") + "-no-background.png",
        busy: false,
      });
      setProgress("Background removed locally.");
    } catch (e) {
      update(row.id, { busy: false, error: (e as Error).message });
      setProgress(
        "Processing failed. You can retry; your image was not uploaded.",
      );
    } finally {
      worker.current?.terminate();
      worker.current = null;
      cancel.current = null;
      if (alive.current) setBusy(false);
    }
  }
  async function save(row: Row) {
    if (!row.output) return;
    try {
      download(
        row.name || "image.png",
        removal && solid
          ? await solidBackground(row.output, background)
          : row.output,
      );
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  async function zip() {
    try {
      setStatus("Preparing ZIP…");
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      for (const [rowIndex, row] of rows.entries())
        if (row.output && row.settings === settings)
          files[`${rowIndex + 1}-${row.name}`] = new Uint8Array(
            await row.output.arrayBuffer(),
          );
      download(
        "converted-images.zip",
        new Blob([zipSync(files, { level: 0 }).slice().buffer as ArrayBuffer], {
          type: "application/zip",
        }),
      );
      setStatus("ZIP ready.");
    } catch {
      setStatus(
        "ZIP creation failed. Try fewer images or individual downloads.",
      );
    }
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          {removal
            ? "Keep what matters."
            : "A new format. The same great image."}
        </h2>
        <span className="badge">Images stay on your device</span>
      </div>
      {removal && (
        <p className="subtle">
          Real IS-Net model, running in a browser worker on your CPU. First use
          downloads about 40 MB of model data plus the WebAssembly runtime from
          staticimgly.com. Enable optional internet features in Settings for
          that download. Model assets are cached where browser storage permits;
          images are never uploaded or saved. Allow a few hundred MB of free
          memory. AGPL-3.0 software/model; see licensing documentation.
        </p>
      )}
      {removal && (
        <p className="subtle">
          <a href="https://github.com/bibacau/tools">
            Source and licenses · AGPL-3.0
          </a>
        </p>
      )}
      <label
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) void add(e.dataTransfer.files);
        }}
      >
        <Upload size={27} />
        <strong>Drop images here, or choose files</strong>
        <span>JPG, PNG, WebP · up to 25 MB / 40 MP each · max 20 files</span>
        <input
          aria-label="Choose images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={!removal}
          disabled={busy}
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <div className="form-row">
        {!removal && (
          <>
            <label>
              Output format
              <select
                aria-label="Output format"
                disabled={busy}
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                {formats.map((f) => (
                  <option value={f} key={f}>
                    {extension(f).toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            {format !== "image/png" && (
              <label>
                Quality · {Math.round(quality * 100)}%
                <input
                  aria-label="Quality"
                  type="range"
                  min=".1"
                  max="1"
                  step=".01"
                  disabled={busy}
                  value={quality}
                  onChange={(e) => setQuality(+e.target.value)}
                />
              </label>
            )}
          </>
        )}
        {(format === "image/jpeg" || removal) && (
          <label>
            {removal ? "Optional solid background" : "JPG background color"}
            <input
              aria-label="Background color"
              type="color"
              disabled={busy}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
          </label>
        )}
        {removal && (
          <label className="check">
            <input
              type="checkbox"
              checked={solid}
              onChange={(e) => setSolid(e.target.checked)}
            />
            Add solid color to downloaded PNG
          </label>
        )}
      </div>
      {!removal && (
        <div className="actions">
          <button
            className="primary"
            disabled={busy || !rows.some((r) => r.width)}
            onClick={convert}
          >
            {busy ? "Converting…" : "Convert images"}
          </button>
          <button
            disabled={
              busy || !rows.some((r) => r.output && r.settings === settings)
            }
            onClick={zip}
          >
            Download all as ZIP
          </button>
        </div>
      )}
      {removal && busy && (
        <button
          onClick={() => {
            cancel.current?.(Error("Processing cancelled."));
          }}
        >
          Cancel processing
        </button>
      )}
      <p role="status">{progress || status}</p>
      {progress && status && <p role="status">{status}</p>}
      <div className="image-grid">
        {rows.map((row) => (
          <article className="image-result" key={row.id}>
            <div className="section-heading">
              <h3>{row.file.name}</h3>
              <button
                aria-label={"Remove " + row.file.name}
                disabled={busy}
                onClick={() => {
                  revoke(row.url);
                  revoke(row.outputURL);
                  setRows((v) => v.filter((r) => r.id !== row.id));
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="image-comparison">
              {row.url && (
                <figure>
                  <div className="checkerboard">
                    <img src={row.url} alt={"Original " + row.file.name} />
                  </div>
                  <figcaption>
                    Original · {row.width} × {row.height} ·{" "}
                    {bytes(row.file.size)}
                  </figcaption>
                </figure>
              )}
              {row.outputURL && (
                <figure>
                  <div
                    className="checkerboard"
                    style={removal && solid ? { background } : undefined}
                  >
                    <img src={row.outputURL} alt={"Result " + row.file.name} />
                  </div>
                  <figcaption>
                    Result · {bytes(row.output!.size)}
                    {removal && Math.max(row.width, row.height) > 2048
                      ? " · resized to fit 2048 px"
                      : ""}
                  </figcaption>
                </figure>
              )}
            </div>
            {row.error && (
              <p className="error" role="alert">
                {row.error}
              </p>
            )}
            {!removal && row.output && row.settings !== settings && (
              <p className="warning">
                Settings changed. Convert again to update this result.
              </p>
            )}
            <div className="actions">
              {removal && row.width > 0 && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => remove(row)}
                >
                  <Scissors size={15} />
                  {row.busy ? "Processing…" : "Remove background"}
                </button>
              )}
              {row.output && (
                <button
                  disabled={busy || (!removal && row.settings !== settings)}
                  onClick={() => save(row)}
                >
                  <Download size={15} />
                  Download {removal ? "PNG" : extension(format).toUpperCase()}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="subtle">
        Files and outputs stay in memory until you remove them or leave this
        page. PNG/WebP keep transparency; JPG flattens onto your chosen color.
        Conversion removes most metadata. Browser encoding support and available
        memory vary. Background removal can struggle with hair, glass, fine
        edges and unusual subjects.
      </p>
    </section>
  );
}
