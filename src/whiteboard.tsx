import { useState, useEffect, useRef } from "react";
import * as f from "fabric";
import * as store from "./store";
import { saveDocument } from "./documents";
import { validateBoardProject } from "./whiteboard-core";
import { download, dataURLToBlob } from "./utils";
import { convertImage } from "./image-utils";
type Content = { canvas: any; viewport: number[] };
type Active = {
  id: string;
  version?: string;
  name: string;
  content: Content;
  dirty: boolean;
};
export default function Whiteboard() {
  const rows = store.list("whiteboard"),
    [id, setId] = useState(() => {
      const last = localStorage.getItem("personal-os-last-whiteboard");
      return rows.find((r) => r.id === last)?.id || rows[0]?.id || "";
    }),
    [name, setName] = useState(""),
    [tool, setTool] = useState("select"),
    [color, setColor] = useState("#8270f9"),
    [opacity, setOpacity] = useState(1),
    [stroke, setStroke] = useState(3),
    [font, setFont] = useState("Arial"),
    [fontSize, setFontSize] = useState(28),
    [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(false),
    [zoom, setZoom] = useState(1),
    [status, setStatus] = useState(""),
    [count, setCount] = useState(0),
    [boardReady, setBoardReady] = useState(false),
    [selection, setSelection] = useState<any>(null),
    [historyIndex, setHistoryIndex] = useState(0),
    [historyLength, setHistoryLength] = useState(1);
  useEffect(() => {
    if (id) localStorage.setItem("personal-os-last-whiteboard", id);
  }, [id]);
  const finishPolygonRef = useRef<() => void>(() => {});
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<f.Canvas | null>(null),
    active = useRef<Active | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined),
    loading = useRef(false),
    history = useRef<string[]>([]),
    cursor = useRef(0),
    settings = useRef({ tool, color, opacity, stroke, font, fontSize, snap }),
    alive = useRef(true);
  settings.current = { tool, color, opacity, stroke, font, fontSize, snap };
  function flush() {
    const a = active.current;
    if (!a?.dirty) return;
    const result = saveDocument(
      a.id,
      { type: "whiteboard", name: a.name, content: a.content },
      a.version,
    );
    a.version = result.version;
    a.dirty = false;
    if (alive.current) {
      setStatus(
        result.conflict
          ? "Concurrent edits preserved as a conflict copy."
          : "Saved on this device",
      );
      if (result.id !== a.id) setId(result.id);
    }
  }
  function snapshot(track = true) {
    const c = canvas.current,
      a = active.current;
    if (!c || !a || loading.current) return;
    a.content = { canvas: c.toJSON(), viewport: [...c.viewportTransform] };
    a.dirty = true;
    setStatus("Saving on this device…");
    const text = JSON.stringify(a.content.canvas);
    if (track && history.current[cursor.current] !== text) {
      history.current = [
        ...history.current.slice(0, cursor.current + 1),
        text,
      ].slice(-60);
      while (
        history.current.length > 2 &&
        history.current.reduce((n, s) => n + s.length, 0) > 24 * 1048576
      )
        history.current.shift();
      cursor.current = history.current.length - 1;
      setHistoryIndex(cursor.current);
      setHistoryLength(history.current.length);
    }
    setCount(c.getObjects().length);
    setZoom(c.getZoom());
    host.current?.style.setProperty(
      "--grid-size",
      String(20 * c.getZoom()) + "px",
    );
    host.current?.style.setProperty("--grid-x", c.viewportTransform[4] + "px");
    host.current?.style.setProperty("--grid-y", c.viewportTransform[5] + "px");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 300);
  }
  const selected = () => {
    const o = canvas.current?.getActiveObject();
    if (o) {
      setSelection({
        left: Math.round(o.left),
        top: Math.round(o.top),
        width: Math.round(o.getScaledWidth()),
        height: Math.round(o.getScaledHeight()),
        angle: Math.round(o.angle),
        type: o.type,
      });
    } else setSelection(null);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(saveTimer.current);
      flush();
    };
  }, []);
  useEffect(() => {
    if (!id || !host.current) return;
    const row = store.all().find((r) => r.id === id);
    if (!row) return;
    const data = row.data;
    setName(data.name);
    active.current = {
      id,
      version: row.version,
      name: data.name,
      content: data.content || {
        canvas: { objects: [] },
        viewport: [1, 0, 0, 1, 0, 0],
      },
      dirty: false,
    };
    const el = document.createElement("canvas");
    host.current.replaceChildren(el);
    const c = new f.Canvas(el, {
      width: host.current.clientWidth || 800,
      height: window.innerWidth < 620 ? 430 : 560,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
      allowTouchScrolling: false,
    });
    canvas.current = c;
    loading.current = true;
    setBoardReady(false);
    let disposed = false;
    const configure = () => {
      c.isDrawingMode = ["pen", "pencil", "highlighter"].includes(
        settings.current.tool,
      );
    };
    void c
      .loadFromJSON(active.current.content.canvas)
      .then(() => {
        if (disposed) return;
        const viewport = active.current?.content.viewport;
        if (viewport) c.setViewportTransform(viewport as f.TMat2D);
        c.backgroundColor = c.backgroundColor || "#ffffff";
        loading.current = false;
        setBoardReady(true);
        history.current = [JSON.stringify(c.toJSON())];
        cursor.current = 0;
        setHistoryIndex(0);
        setHistoryLength(1);
        setCount(c.getObjects().length);
        setZoom(c.getZoom());
        configure();
        c.requestRenderAll();
      })
      .catch((e) => {
        loading.current = false;
        setStatus("Cannot load board: " + e.message);
      });
    let start: f.Point | null = null,
      draft: f.FabricObject | null = null,
      pan = false,
      last = { x: 0, y: 0 },
      space = false,
      polygon: f.Point[] = [];
    let polyDraft: f.Polyline | null = null;
    const location = (e: any) => c.getScenePoint(e);
    const point = (p: f.Point) =>
      settings.current.snap
        ? new f.Point(Math.round(p.x / 20) * 20, Math.round(p.y / 20) * 20)
        : p;
    function finishPolygon() {
      if (polygon.length < 3) {
        setStatus("Add at least three polygon points.");
        return;
      }
      if (polyDraft) c.remove(polyDraft);
      c.add(
        new f.Polygon(polygon, {
          fill: "transparent",
          stroke: settings.current.color,
          strokeWidth: settings.current.stroke,
          opacity: settings.current.opacity,
        }),
      );
      polygon = [];
      polyDraft = null;
      snapshot();
    }
    finishPolygonRef.current = finishPolygon;
    c.on("mouse:down", (event) => {
      const e = event.e as any;
      if (loading.current) return;
      const mode = settings.current.tool;
      const p = point(location(e));
      if (mode === "pan" || space || e.altKey) {
        pan = true;
        last = {
          x: e.clientX ?? e.touches?.[0]?.clientX,
          y: e.clientY ?? e.touches?.[0]?.clientY,
        };
        c.selection = false;
        return;
      }
      if (mode === "eraser") {
        if (event.target) {
          c.remove(event.target);
          snapshot();
        }
        return;
      }
      if (mode === "polygon") {
        polygon.push(p);
        if (polyDraft) c.remove(polyDraft);
        loading.current = true;
        polyDraft = new f.Polyline(polygon, {
          fill: "transparent",
          stroke: settings.current.color,
          strokeWidth: settings.current.stroke,
          evented: false,
          selectable: false,
        });
        c.add(polyDraft);
        loading.current = false;
        c.requestRenderAll();
        return;
      }
      if (["rectangle", "circle", "line", "arrow"].includes(mode)) {
        start = p;
        const opts = {
          left: p.x,
          top: p.y,
          fill: "transparent",
          stroke: settings.current.color,
          strokeWidth: settings.current.stroke,
          opacity: settings.current.opacity,
          selectable: false,
          evented: false,
        };
        draft =
          mode === "rectangle"
            ? new f.Rect({ ...opts, width: 1, height: 1 })
            : mode === "circle"
              ? new f.Ellipse({ ...opts, rx: 1, ry: 1 })
              : new f.Line([p.x, p.y, p.x, p.y], opts);
        loading.current = true;
        c.add(draft);
        loading.current = false;
      }
    });
    c.on("mouse:move", (event) => {
      const e = event.e as any;
      if (pan) {
        const x = e.clientX ?? e.touches?.[0]?.clientX,
          y = e.clientY ?? e.touches?.[0]?.clientY;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          c.relativePan(new f.Point(x - last.x, y - last.y));
          last = { x, y };
        }
        return;
      }
      if (
        settings.current.tool === "eraser" &&
        (e.buttons === 1 || e.touches?.length)
      ) {
        const o = c.findTarget(e);
        if (o) {
          c.remove(o);
          snapshot();
        }
        return;
      }
      if (start && draft) {
        const p = point(location(e));
        if (draft instanceof f.Line)
          draft.set({ x1: start.x, y1: start.y, x2: p.x, y2: p.y });
        else if (draft instanceof f.Ellipse)
          draft.set({
            left: Math.min(start.x, p.x),
            top: Math.min(start.y, p.y),
            rx: Math.abs(p.x - start.x) / 2,
            ry: Math.abs(p.y - start.y) / 2,
          });
        else
          draft.set({
            left: Math.min(start.x, p.x),
            top: Math.min(start.y, p.y),
            width: Math.abs(p.x - start.x),
            height: Math.abs(p.y - start.y),
          });
        c.requestRenderAll();
      }
    });
    c.on("mouse:up", () => {
      if (pan) {
        pan = false;
        c.selection = settings.current.tool === "select";
        snapshot(false);
      }
      if (draft && start) {
        if (settings.current.tool === "arrow" && draft instanceof f.Line) {
          const line = draft;
          const angle =
            (Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180) / Math.PI +
            90;
          const head = new f.Triangle({
            left: line.x2,
            top: line.y2,
            width: 14,
            height: 18,
            originX: "center",
            originY: "center",
            angle,
            fill: settings.current.color,
            opacity: settings.current.opacity,
          });
          loading.current = true;
          c.remove(line);
          const arrow = new f.Group([line, head]);
          c.add(arrow);
          loading.current = false;
        }
        draft.setCoords();
        draft = null;
        start = null;
        snapshot();
      }
    });
    c.on("mouse:dblclick", () => {
      if (settings.current.tool === "polygon") finishPolygon();
    });
    c.on("path:created", () => snapshot());
    c.on("object:modified", () => {
      if (settings.current.snap) {
        for (const o of c.getActiveObjects())
          o.set({
            left: Math.round(o.left / 20) * 20,
            top: Math.round(o.top / 20) * 20,
          });
        c.requestRenderAll();
      }
      snapshot();
      selected();
    });
    c.on("selection:created", selected);
    c.on("selection:updated", selected);
    c.on("selection:cleared", selected);
    c.on("mouse:wheel", (event) => {
      const e = event.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      const next = Math.min(
        10,
        Math.max(0.1, c.getZoom() * Math.pow(0.999, e.deltaY)),
      );
      c.zoomToPoint(c.getViewportPoint(e), next);
      snapshot(false);
    });
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        (c.getActiveObject() as any)?.isEditing
      )
        return;
      if (e.code === "Space") {
        space = true;
        e.preventDefault();
      }
      if (e.key === "Enter" && settings.current.tool === "polygon")
        finishPolygon();
      if (e.key === "Escape") {
        c.discardActiveObject();
        if (polyDraft) {
          c.remove(polyDraft);
          polyDraft = null;
          polygon = [];
        }
        c.requestRenderAll();
        selected();
      }
      if (["Delete", "Backspace"].includes(e.key)) {
        e.preventDefault();
        for (const o of c.getActiveObjects()) c.remove(o);
        c.discardActiveObject();
        snapshot();
        selected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo(e.shiftKey ? 1 : -1);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void undo(1);
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        for (const o of c.getActiveObjects()) {
          o.set({
            left:
              o.left +
              (e.key === "ArrowLeft"
                ? -delta
                : e.key === "ArrowRight"
                  ? delta
                  : 0),
            top:
              o.top +
              (e.key === "ArrowUp"
                ? -delta
                : e.key === "ArrowDown"
                  ? delta
                  : 0),
          });
          o.setCoords();
        }
        c.requestRenderAll();
        snapshot();
        selected();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space = false;
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    const observer = new ResizeObserver(() => {
      if (!disposed && host.current)
        c.setDimensions({
          width: host.current.clientWidth,
          height: window.innerWidth < 620 ? 430 : 560,
        });
    });
    observer.observe(host.current);
    const paste = (e: ClipboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,[contenteditable=true]",
        )
      )
        return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.some((x) => x.type.startsWith("image/"))) {
        e.preventDefault();
        void addImages(files);
      }
    };
    window.addEventListener("paste", paste);
    return () => {
      flush();
      disposed = true;
      loading.current = false;
      observer.disconnect();
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
      window.removeEventListener("paste", paste);
      if (canvas.current === c) canvas.current = null;
      void c.dispose();
    };
  }, [id]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.isDrawingMode = ["pen", "pencil", "highlighter"].includes(tool);
    c.selection = tool === "select";
    c.defaultCursor =
      tool === "pan" ? "grab" : tool === "eraser" ? "not-allowed" : "crosshair";
    if (c.isDrawingMode) {
      const brush = new f.PencilBrush(c);
      brush.width =
        tool === "highlighter"
          ? Math.max(12, stroke)
          : tool === "pencil"
            ? Math.max(0.5, stroke * 0.45)
            : stroke;
      brush.color = new f.Color(color)
        .setAlpha(
          tool === "highlighter"
            ? Math.min(0.3, opacity)
            : tool === "pencil"
              ? opacity * 0.7
              : opacity,
        )
        .toRgba();
      c.freeDrawingBrush = brush;
    }
    for (const o of c.getObjects())
      o.set({
        selectable: tool === "select",
        evented: tool === "select" || tool === "eraser",
      });
    c.requestRenderAll();
  }, [tool, color, stroke, opacity, id]);
  async function undo(delta: number) {
    const c = canvas.current,
      next = cursor.current + delta;
    if (!c || loading.current || next < 0 || next >= history.current.length)
      return;
    loading.current = true;
    clearTimeout(saveTimer.current);
    try {
      await c.loadFromJSON(JSON.parse(history.current[next]));
      cursor.current = next;
      setHistoryIndex(next);
      loading.current = false;
      c.requestRenderAll();
      snapshot(false);
      selected();
    } catch (e) {
      loading.current = false;
      setStatus((e as Error).message);
    }
  }
  const center = () => canvas.current?.getVpCenter() || new f.Point(100, 100);
  function addObject(kind: string) {
    const c = canvas.current;
    if (!c) return;
    const p = center(),
      opts = {
        left: p.x,
        top: p.y,
        originX: "center" as const,
        originY: "center" as const,
        stroke: color,
        strokeWidth: stroke,
        fill: "transparent",
        opacity,
      };
    let object: f.FabricObject;
    if (kind === "text")
      object = new f.Textbox("Your idea here", {
        ...opts,
        stroke: undefined,
        fill: color,
        fontFamily: font,
        fontSize,
        width: 220,
      });
    else if (kind === "circle")
      object = new f.Ellipse({ ...opts, rx: 55, ry: 45 });
    else if (kind === "line")
      object = new f.Line([p.x - 70, p.y, p.x + 70, p.y], {
        stroke: color,
        strokeWidth: stroke,
        opacity,
      });
    else if (kind === "polygon")
      object = new f.Polygon(
        [
          { x: 0, y: 80 },
          { x: 40, y: 0 },
          { x: 100, y: 15 },
          { x: 130, y: 80 },
          { x: 70, y: 120 },
        ],
        opts,
      );
    else if (kind === "arrow") {
      const line = new f.Line([p.x - 70, p.y, p.x + 60, p.y], {
        stroke: color,
        strokeWidth: stroke,
        opacity,
      });
      const head = new f.Triangle({
        left: p.x + 60,
        top: p.y,
        width: 16,
        height: 20,
        originX: "center",
        originY: "center",
        angle: 90,
        fill: color,
        opacity,
      });
      object = new f.Group([line, head]);
    } else object = new f.Rect({ ...opts, width: 140, height: 90 });
    c.add(object);
    c.setActiveObject(object);
    setTool("select");
    c.requestRenderAll();
    snapshot();
    selected();
  }
  async function addImages(files: File[]) {
    for (const file of files) {
      try {
        const c = canvas.current;
        if (!c) return;
        const converted = await convertImage(
          file,
          "image/webp",
          0.82,
          "transparent",
          1600,
        );
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(converted.blob);
        });
        if (data.length > 3 * 1048576)
          throw Error("Image is too large; choose a smaller image.");
        if (JSON.stringify(c.toJSON()).length + data.length > 9 * 1048576)
          throw Error(
            "Board image budget reached. Create another board or export a backup.",
          );
        const image = await f.FabricImage.fromURL(data);
        const p = center();
        image.set({
          left: p.x,
          top: p.y,
          originX: "center",
          originY: "center",
        });
        image.scaleToWidth(Math.min(400, converted.width));
        c.add(image);
        c.setActiveObject(image);
        setTool("select");
        snapshot();
        selected();
      } catch (e) {
        setStatus((e as Error).message);
      }
    }
  }
  function group(ungroup = false) {
    const c = canvas.current;
    if (!c) return;
    const activeObject = c.getActiveObject();
    if (
      ungroup &&
      activeObject instanceof f.Group &&
      !(activeObject instanceof f.ActiveSelection)
    ) {
      const children = activeObject.getObjects(),
        matrices = children.map((o) => o.calcTransformMatrix());
      c.discardActiveObject();
      c.remove(activeObject);
      activeObject.removeAll();
      children.forEach((o, i) => {
        f.util.applyTransformToObject(o, matrices[i]);
        c.add(o);
      });
    } else {
      const objects = c.getActiveObjects();
      if (objects.length < 2) {
        setStatus(
          "Select two or more objects to group (Shift-click or drag a selection).",
        );
        return;
      }
      c.discardActiveObject();
      objects.forEach((o) => c.remove(o));
      const g = new f.Group(objects);
      c.add(g);
      c.setActiveObject(g);
    }
    c.requestRenderAll();
    snapshot();
    selected();
  }
  function editSelection(values: Record<string, any>) {
    const c = canvas.current,
      o = c?.getActiveObject();
    if (!c || !o) return;
    if (values.width !== undefined) {
      o.scaleX = Math.max(1, values.width) / Math.max(1, o.width);
      delete values.width;
    }
    if (values.height !== undefined) {
      o.scaleY = Math.max(1, values.height) / Math.max(1, o.height);
      delete values.height;
    }
    o.set(values);
    o.setCoords();
    c.requestRenderAll();
    snapshot();
    selected();
  }
  async function exportBoard(format: "png" | "svg" | "pdf") {
    const c = canvas.current;
    if (!c) return;
    flush();
    try {
      c.discardActiveObject();
      const all = c.getObjects().map((o) => o.getBoundingRect());
      const left = all.length ? Math.min(...all.map((b) => b.left)) - 20 : 0,
        top = all.length ? Math.min(...all.map((b) => b.top)) - 20 : 0,
        right = all.length
          ? Math.max(...all.map((b) => b.left + b.width)) + 20
          : 800,
        bottom = all.length
          ? Math.max(...all.map((b) => b.top + b.height)) + 20
          : 500;
      const width = Math.max(1, right - left),
        height = Math.max(1, bottom - top);
      if (format === "svg") {
        const old = c.svgViewportTransformation;
        c.svgViewportTransformation = false;
        const value = c.toSVG({
          viewBox: { x: left, y: top, width, height },
          width: String(width),
          height: String(height),
        });
        c.svgViewportTransformation = old;
        download(name + ".svg", value, "image/svg+xml");
        return;
      }
      const clone = new f.StaticCanvas(document.createElement("canvas"), {
        width: 1,
        height: 1,
      });
      await clone.loadFromJSON(c.toJSON());
      clone.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const scale = Math.min(1, 4096 / Math.max(width, height));
      const url = clone.toDataURL({
        format: "png",
        left,
        top,
        width,
        height,
        multiplier: scale,
        enableRetinaScaling: false,
      });
      void clone.dispose();
      const blob = dataURLToBlob(url);
      if (format === "png") download(name + ".png", blob);
      else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: width > height ? "landscape" : "portrait",
          unit: "pt",
          format: [Math.min(width, 10000), Math.min(height, 10000)],
        });
        pdf.addImage(
          url,
          "PNG",
          0,
          0,
          pdf.internal.pageSize.getWidth(),
          pdf.internal.pageSize.getHeight(),
        );
        download(name + ".pdf", pdf.output("blob"));
      }
    } catch (e) {
      setStatus("Export failed: " + (e as Error).message);
    }
  }
  function add() {
    flush();
    setId(
      store.create("whiteboard", {
        name: "My whiteboard",
        content: {
          canvas: { version: "6.0.0", objects: [], background: "#ffffff" },
          viewport: [1, 0, 0, 1, 0, 0],
        },
      }),
    );
  }
  return (
    <section className="panel whiteboard">
      <div className="actions">
        <select
          aria-label="Saved whiteboards"
          value={id}
          onChange={(e) => {
            flush();
            setId(e.target.value);
          }}
        >
          <option value="">Choose a whiteboard</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.data.name}
            </option>
          ))}
        </select>
        <button className="primary" onClick={add}>
          New whiteboard
        </button>
        <button
          disabled={!id}
          onClick={() => {
            flush();
            const a = active.current;
            if (a)
              setId(
                store.create("whiteboard", {
                  name: a.name + " copy",
                  content: a.content,
                }),
              );
          }}
        >
          Duplicate
        </button>
        <button
          disabled={!id}
          onClick={() => {
            if (confirm("Delete this whiteboard?")) {
              if (active.current) active.current.dirty = false;
              void store.remove(id);
              setId("");
            }
          }}
        >
          Delete board
        </button>
        <label className="file-button">
          Import project
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1048576)
                  throw Error("Project exceeds 10 MB");
                const value = validateBoardProject(
                  JSON.parse(await file.text()),
                );
                flush();
                setId(
                  store.create("whiteboard", {
                    name: value.name,
                    content: value.content,
                  }),
                );
              } catch (e) {
                setStatus((e as Error).message);
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {!id ? (
        <div className="empty">
          <h2>A little room to think bigger.</h2>
          <p>
            Create a whiteboard. Sketch, arrange ideas, and keep it all on your
            device.
          </p>
          <button onClick={add}>Create whiteboard</button>
        </div>
      ) : (
        <>
          <label>
            Whiteboard name
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (active.current) {
                  active.current.name = e.target.value;
                  active.current.dirty = true;
                  clearTimeout(saveTimer.current);
                  saveTimer.current = setTimeout(flush, 300);
                }
              }}
            />
          </label>
          <fieldset className="board-controls" disabled={!boardReady}>
            <div className="drawing-toolbar">
              {[
                "select",
                "pan",
                "pen",
                "pencil",
                "highlighter",
                "eraser",
                "rectangle",
                "circle",
                "line",
                "arrow",
                "polygon",
              ].map((t) => (
                <button
                  key={t}
                  className={tool === t ? "active" : ""}
                  onClick={() => {
                    canvas.current?.discardActiveObject();
                    setTool(t);
                  }}
                >
                  {t}
                </button>
              ))}
              {tool === "polygon" && (
                <button onClick={() => finishPolygonRef.current()}>
                  Finish polygon
                </button>
              )}
            </div>
            <div className="actions">
              <label>
                Color
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
              <label>
                Opacity
                <input
                  type="range"
                  min=".05"
                  max="1"
                  step=".05"
                  value={opacity}
                  onChange={(e) => setOpacity(+e.target.value)}
                />
              </label>
              <label>
                Thickness
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={stroke}
                  onChange={(e) =>
                    setStroke(Math.max(1, Math.min(60, +e.target.value)))
                  }
                />
              </label>
              <label>
                Font
                <select value={font} onChange={(e) => setFont(e.target.value)}>
                  {[
                    "Arial",
                    "Georgia",
                    "Courier New",
                    "Verdana",
                    "Times New Roman",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Text size
                <input
                  type="number"
                  min="8"
                  max="160"
                  value={fontSize}
                  onChange={(e) =>
                    setFontSize(Math.max(8, Math.min(160, +e.target.value)))
                  }
                />
              </label>
            </div>
            <div className="actions">
              {["rectangle", "circle", "line", "arrow", "polygon", "text"].map(
                (t) => (
                  <button key={t} onClick={() => addObject(t)}>
                    Add {t}
                  </button>
                ),
              )}
              <label className="file-button">
                Insert images
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(e) => {
                    void addImages(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="actions">
              <button
                disabled={historyIndex === 0}
                onClick={() => void undo(-1)}
              >
                Undo
              </button>
              <button
                disabled={historyIndex >= historyLength - 1}
                onClick={() => void undo(1)}
              >
                Redo
              </button>
              <button
                onClick={() => {
                  const c = canvas.current;
                  if (!c) return;
                  c.discardActiveObject();
                  c.setActiveObject(
                    new f.ActiveSelection(c.getObjects(), { canvas: c }),
                  );
                  setTool("select");
                  c.requestRenderAll();
                  selected();
                }}
              >
                Select all
              </button>
              <button onClick={() => group()}>Group</button>
              <button onClick={() => group(true)}>Ungroup</button>
              <button
                disabled={!selection}
                onClick={() => {
                  const c = canvas.current;
                  if (!c) return;
                  c.getActiveObjects().forEach((o) => c.remove(o));
                  c.discardActiveObject();
                  snapshot();
                  selected();
                }}
              >
                Delete selection
              </button>
              <button
                onClick={() => {
                  const c = canvas.current;
                  if (c) {
                    c.zoomToPoint(
                      new f.Point(c.width / 2, c.height / 2),
                      Math.min(10, c.getZoom() * 1.25),
                    );
                    snapshot(false);
                  }
                }}
              >
                Zoom +
              </button>
              <button
                onClick={() => {
                  const c = canvas.current;
                  if (c) {
                    c.zoomToPoint(
                      new f.Point(c.width / 2, c.height / 2),
                      Math.max(0.1, c.getZoom() / 1.25),
                    );
                    snapshot(false);
                  }
                }}
              >
                Zoom −
              </button>
              <button
                onClick={() => {
                  canvas.current?.setViewportTransform([1, 0, 0, 1, 0, 0]);
                  snapshot(false);
                }}
              >
                Reset view
              </button>
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
                  checked={snap}
                  onChange={(e) => setSnap(e.target.checked)}
                />
                Snap to grid
              </label>
            </div>
            <div
              ref={host}
              className={"board-canvas-host " + (grid ? "board-grid" : "")}
              role="application"
              aria-label="Interactive whiteboard canvas"
              tabIndex={0}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addImages(Array.from(e.dataTransfer.files));
              }}
            />
            <p className="subtle">
              {count} objects · {Math.round(zoom * 100)}% zoom · Space/Alt-drag
              or Pan to move the infinite canvas. Wheel to zoom. Shift-click to
              multi-select. Drag handles to resize/rotate. Polygon: click
              points, then Enter/double-click. Eraser removes whole
              objects/strokes. Ctrl/⌘+Z undo; Shift+Ctrl/⌘+Z redo.
            </p>
            {selection && (
              <div className="selection-properties">
                <h3>Selected {selection.type}</h3>
                <div className="form-row">
                  {["left", "top", "width", "height", "angle"].map((key) => (
                    <label key={key}>
                      {key === "left" ? "X" : key === "top" ? "Y" : key}
                      <input
                        type="number"
                        aria-label={"Selected " + key}
                        value={selection[key]}
                        onChange={(e) =>
                          editSelection({ [key]: +e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="actions">
                  <button
                    onClick={() => {
                      const o = canvas.current?.getActiveObject();
                      if (o)
                        editSelection({
                          opacity,
                          strokeWidth: stroke,
                          ...(o instanceof f.Textbox || o instanceof f.IText
                            ? { fill: color, fontFamily: font, fontSize }
                            : { stroke: color }),
                        });
                    }}
                  >
                    Apply style to selection
                  </button>
                </div>
              </div>
            )}
            <div className="actions">
              <button onClick={() => void exportBoard("png")}>
                Export PNG
              </button>
              <button onClick={() => void exportBoard("svg")}>
                Export SVG
              </button>
              <button onClick={() => void exportBoard("pdf")}>
                Export PDF
              </button>
              <button
                onClick={() => {
                  flush();
                  if (active.current)
                    download(
                      name + ".whiteboard.json",
                      JSON.stringify(
                        {
                          format: "personal-os-whiteboard",
                          version: 1,
                          name,
                          content: active.current.content,
                        },
                        null,
                        2,
                      ),
                      "application/json",
                    );
                }}
              >
                Editable project
              </button>
            </div>
          </fieldset>
        </>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
