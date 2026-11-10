import bootstrapSource from "./preview-bootstrap.js?raw";
import { useState, useEffect, useRef, useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { css as cssLanguage } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import * as store from "./store";
import { saveDocument } from "./documents";
import { templates, standaloneHTML } from "./playground-core";
import { download } from "./utils";
type Project = {
  type: string;
  name: string;
  html: string;
  css: string;
  js: string;
};
export default function Playground() {
  const rows = store.list("playground"),
    [selected, setSelected] = useState(rows[0]?.id || ""),
    [draft, setDraft] = useState<Project>({
      type: "playground",
      name: "Untitled project",
      ...templates["Hello world"],
    }),
    [tab, setTab] = useState<"html" | "css" | "js">("html"),
    [theme, setTheme] = useState<"dark" | "light">("dark"),
    [width, setWidth] = useState("100%"),
    [preview, setPreview] = useState(0),
    [auto, setAuto] = useState(true),
    [external, setExternal] = useState(false),
    [logs, setLogs] = useState<{ level: string; text: string }[]>([]),
    [status, setStatus] = useState(""),
    [full, setFull] = useState(false),
    [split, setSplit] = useState(50),
    [offlinePreview, setOfflinePreview] = useState(!navigator.onLine);
  const iframe = useRef<HTMLIFrameElement>(null),
    version = useRef<string | undefined>(undefined),
    draftRef = useRef(draft),
    dirty = useRef(false),
    idRef = useRef(selected),
    token = useRef(crypto.randomUUID());
  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = false;
    if (offlinePreview) return;
    const timer = setTimeout(() => {
      if (!readyRef.current) setOfflinePreview(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [preview, offlinePreview]);
  const currentToken = useMemo(() => crypto.randomUUID(), [preview]);
  token.current = currentToken;
  draftRef.current = draft;
  idRef.current = selected;
  const persist = () => {
    if (!dirty.current || !idRef.current) return;
    const result = saveDocument(
      idRef.current,
      draftRef.current,
      version.current,
    );
    version.current = result.version;
    dirty.current = false;
    setStatus(
      result.conflict
        ? "Concurrent change preserved. Your draft was saved as a conflict copy."
        : "Saved on this device",
    );
    if (result.id !== idRef.current) setSelected(result.id);
  };
  useEffect(() => {
    const row = store.all().find((r) => r.id === selected);
    if (row) {
      setDraft(row.data as Project);
      draftRef.current = row.data as Project;
      version.current = row.version;
      dirty.current = false;
    }
    setLogs([]);
    setPreview((v) => v + 1);
  }, [selected]);
  useEffect(() => {
    const timer = setTimeout(() => {
      persist();
      if (auto) setPreview((v) => v + 1);
    }, 450);
    return () => clearTimeout(timer);
  }, [draft, auto]);
  useEffect(
    () => () => {
      if (dirty.current && idRef.current)
        saveDocument(idRef.current, draftRef.current, version.current);
    },
    [],
  );
  useEffect(() => {
    setLogs([]);
  }, [preview]);
  useEffect(() => {
    const save = () => persist();
    window.addEventListener("pagehide", save);
    const hidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (
        e.source === iframe.current?.contentWindow &&
        e.origin === "null" &&
        e.data?.kind === "preview-ready" &&
        e.data.token === token.current
      ) {
        readyRef.current = true;
        return;
      }
      if (
        e.source !== iframe.current?.contentWindow ||
        e.origin !== "null" ||
        e.data?.kind !== "preview-console" ||
        e.data.token !== token.current
      )
        return;
      if (typeof e.data.text !== "string") return;
      setLogs((v) => [
        ...v.slice(-99),
        { level: String(e.data.level), text: e.data.text.slice(0, 4000) },
      ]);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  const change = (values: Partial<Project>) => {
    dirty.current = true;
    setStatus("Saving on this device…");
    draftRef.current = { ...draftRef.current, ...values };
    setDraft(draftRef.current);
  };
  const choose = (id: string) => {
    persist();
    setSelected(id);
  };
  const add = (name = "My little website", code = templates["Hello world"]) => {
    persist();
    setSelected(store.create("playground", { ...code, name }));
  };
  async function format() {
    try {
      const prettier = await import("prettier/standalone");
      const plugins = await Promise.all([
        import("prettier/plugins/html"),
        import("prettier/plugins/postcss"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ]);
      const parser = tab === "html" ? "html" : tab === "css" ? "css" : "babel";
      change({
        [tab]: await prettier.format(draft[tab], {
          parser,
          plugins: plugins.map((p) => p.default),
          tabWidth: 2,
        }),
      });
      setStatus("Code formatted");
    } catch (e) {
      setStatus("Formatting failed: " + (e as Error).message);
    }
  }
  async function zip() {
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const styles = '<link rel="stylesheet" href="style.css">',
        script = '<script src="script.js"></script>';
      let html = draft.html;
      if (/<html[\s>]/i.test(html)) {
        html = /<\/head>/i.test(html)
          ? html.replace(/<\/head>/i, styles + "</head>")
          : styles + html;
        html = /<\/body>/i.test(html)
          ? html.replace(/<\/body>/i, script + "</body>")
          : html + script;
      } else
        html =
          '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          styles +
          "</head><body>" +
          html +
          script +
          "</body></html>";
      const value = zipSync({
        "index.html": strToU8(html),
        "style.css": strToU8(draft.css),
        "script.js": strToU8(draft.js),
        "project.json": strToU8(JSON.stringify(draft, null, 2)),
      });
      download(
        draft.name + ".zip",
        new Blob([value.slice().buffer as ArrayBuffer], {
          type: "application/zip",
        }),
      );
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <section
      className={"panel playground " + (full ? "editor-fullscreen" : "")}
    >
      <div className="actions">
        <select
          aria-label="Saved playground projects"
          value={selected}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Choose a project</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.data.name}
            </option>
          ))}
        </select>
        <button onClick={() => add()}>New project</button>
        <button
          disabled={!selected}
          onClick={() => add(draft.name + " copy", draft)}
        >
          Duplicate
        </button>
        <button
          disabled={!selected}
          onClick={() => {
            if (confirm("Delete this project?")) {
              dirty.current = false;
              void store.remove(selected);
              setSelected("");
            }
          }}
        >
          Delete
        </button>
        <button onClick={() => setFull((v) => !v)}>
          {full ? "Exit full screen" : "Full screen"}
        </button>
      </div>
      {!selected ? (
        <div className="empty">
          <h2>A small space for your next big idea.</h2>
          <p>
            Write HTML, CSS and JavaScript. Your preview runs in an isolated
            sandbox.
          </p>
          <button className="primary" onClick={() => add()}>
            Create a project
          </button>
        </div>
      ) : (
        <>
          <label>
            Project name
            <input
              value={draft.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <div className="actions">
            <label>
              Starter template
              <select
                aria-label="Starter template"
                defaultValue=""
                onChange={(e) => {
                  if (
                    e.target.value &&
                    confirm("Replace this project’s code with the template?")
                  )
                    change(templates[e.target.value]);
                  e.target.value = "";
                }}
              >
                <option value="">Choose template</option>
                {Object.keys(templates).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Editor theme
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as "dark" | "light")}
              >
                <option>dark</option>
                <option>light</option>
              </select>
            </label>
            <label>
              Preview size
              <select value={width} onChange={(e) => setWidth(e.target.value)}>
                <option value="100%">Desktop</option>
                <option value="768px">Tablet · 768px</option>
                <option value="375px">Mobile · 375px</option>
              </select>
            </label>
            <button onClick={format}>Format {tab.toUpperCase()}</button>
            <button
              onClick={() => {
                persist();
                setPreview((v) => v + 1);
              }}
            >
              Run preview
            </button>
          </div>
          <div className="actions">
            <label className="check">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              Live preview
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={external}
                onChange={(e) => {
                  setExternal(e.target.checked);
                  setPreview((v) => v + 1);
                }}
              />
              Allow HTTPS resources in this preview
            </label>
            <label className="range-split">
              Editor width
              <input
                type="range"
                min="25"
                max="75"
                value={split}
                onChange={(e) => setSplit(+e.target.value)}
              />
            </label>
          </div>
          <p className="subtle">
            Preview scripts cannot access Personal OS data. Popups, forms,
            navigation of the parent, device permissions and nested frames are
            blocked. External resources need HTTPS, CORS/CORP support and
            internet. A script with an infinite loop can still consume browser
            resources; stop it by disabling live preview and reloading.
          </p>
          <div
            className="playground-panels"
            style={{
              gridTemplateColumns: `minmax(0,${split}fr) minmax(0,${100 - split}fr)`,
            }}
          >
            <div>
              <div className="filters">
                {(["html", "css", "js"] as const).map((t) => (
                  <button
                    className={tab === t ? "active" : ""}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <CodeMirror
                aria-label={tab.toUpperCase() + " editor"}
                value={draft[tab]}
                height="440px"
                theme={theme}
                extensions={[
                  EditorView.contentAttributes.of({
                    "aria-label": tab.toUpperCase() + " editor",
                  }),
                  tab === "html"
                    ? htmlLanguage()
                    : tab === "css"
                      ? cssLanguage()
                      : javascript(),
                ]}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  indentOnInput: true,
                }}
                onChange={(value) => change({ [tab]: value })}
              />
            </div>
            <div className="preview-scroll">
              <iframe
                key={preview + "-" + offlinePreview}
                ref={iframe}
                className="code-preview"
                title="Isolated website preview"
                src={offlinePreview ? undefined : "/playground-preview.html"}
                srcDoc={
                  offlinePreview
                    ? '<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; script-src blob: &apos;unsafe-eval&apos; &apos;sha256-' +
                      import.meta.env.VITE_PREVIEW_BOOT_HASH +
                      "&apos;" +
                      (external ? " https:" : "") +
                      "; style-src &apos;unsafe-inline&apos;" +
                      (external ? " https:" : "") +
                      "; img-src data: blob:" +
                      (external ? " https:" : "") +
                      "; font-src data:" +
                      (external ? " https:" : "") +
                      "; connect-src " +
                      (external ? "https:" : "&apos;none&apos;") +
                      '; frame-src &apos;none&apos;;"><script>' +
                      bootstrapSource +
                      "</script>"
                    : undefined
                }
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
                style={{ width }}
                onLoad={(event) => {
                  const frame = event.currentTarget;
                  if (frame.dataset.sent) return;
                  frame.dataset.sent = "yes";
                  frame.contentWindow?.postMessage(
                    {
                      kind: "personal-os-preview",
                      token: token.current,
                      html: draftRef.current.html,
                      css: draftRef.current.css,
                      js: draftRef.current.js,
                      external,
                    },
                    "*",
                  );
                }}
              />
            </div>
          </div>
          <div className="section-heading">
            <h3>Preview console</h3>
            <button onClick={() => setLogs([])}>Clear console</button>
          </div>
          <div className="preview-console" role="log">
            {logs.length ? (
              logs.map((l, i) => (
                <pre className={l.level === "error" ? "error" : ""} key={i}>
                  {l.level}: {l.text}
                </pre>
              ))
            ) : (
              <p className="subtle">
                Console messages and JavaScript errors appear here.
              </p>
            )}
          </div>
          <div className="actions">
            <label className="file-button">
              Import files
              <input
                type="file"
                multiple
                accept=".html,.htm,.css,.js,.json"
                onChange={async (e) => {
                  try {
                    const next: Partial<Project> = {};
                    for (const file of Array.from(e.target.files || [])) {
                      if (file.size > 2 * 1048576)
                        throw Error("Each code file must be under 2 MB.");
                      const text = await file.text();
                      if (file.name.endsWith(".json")) {
                        const value = JSON.parse(text);
                        if (
                          ["html", "css", "js", "name"].some(
                            (k) => typeof value[k] !== "string",
                          )
                        )
                          throw Error("Invalid project JSON");
                        Object.assign(next, {
                          html: value.html,
                          css: value.css,
                          js: value.js,
                          name: value.name,
                        });
                      } else if (/\.html?$/i.test(file.name)) next.html = text;
                      else if (/\.css$/i.test(file.name)) next.css = text;
                      else if (/\.js$/i.test(file.name)) next.js = text;
                      else throw Error("Unsupported code file");
                    }
                    change(next);
                  } catch (e) {
                    setStatus((e as Error).message);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <button onClick={zip}>Export ZIP</button>
            <button
              onClick={() =>
                download(
                  draft.name + ".html",
                  standaloneHTML(draft),
                  "text/html",
                )
              }
            >
              Export standalone HTML
            </button>
            <button
              onClick={() =>
                download(
                  draft.name + ".json",
                  JSON.stringify(draft, null, 2),
                  "application/json",
                )
              }
            >
              Editable project
            </button>
          </div>
          <p role="status">{status}</p>
        </>
      )}
    </section>
  );
}
