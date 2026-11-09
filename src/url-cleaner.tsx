import { useState } from "react";
import { Copy, Link, Trash2 } from "lucide-react";
import { cleanURL } from "./url-utils";
export default function URLCleaner() {
  const [input, setInput] = useState(""),
    [restored, setRestored] = useState<Record<number, number[]>>({}),
    [status, setStatus] = useState("");
  const lines = input
    .split(/\r?\n/)
    .map((text, index) => ({ text, index }))
    .filter((l) => l.text.trim());
  const results = lines.map((l) => {
    try {
      return {
        ...l,
        result: cleanURL(l.text, restored[l.index] || []),
        error: "",
      };
    } catch (e) {
      return { ...l, result: null, error: (e as Error).message };
    }
  });
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied to clipboard");
    } catch {
      setStatus(
        "Clipboard unavailable. Select and copy the result text instead.",
      );
    }
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>A cleaner way to share.</h2>
        <span className="badge">Local only · never fetched</span>
      </div>
      <label>
        URLs · one per line
        <textarea
          rows={6}
          placeholder="https://example.com/article?id=42&utm_source=newsletter#chapter"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setRestored({});
            setStatus("");
          }}
        />
      </label>
      <p className="subtle">
        Removes utm_* and known click/email tracking parameters only. Functional
        parameters, paths, fragments and their encoding are preserved. Changing
        signed links can invalidate them; restore tracking fields or keep the
        original when needed.
      </p>
      <div className="actions">
        <button
          disabled={!results.some((r) => r.result)}
          onClick={() =>
            copy(
              results
                .flatMap((r) => (r.result ? [r.result.cleaned] : []))
                .join("\n"),
            )
          }
        >
          <Copy size={15} />
          Copy all cleaned URLs
        </button>
        <button
          onClick={() => {
            setInput("");
            setRestored({});
          }}
        >
          <Trash2 size={15} />
          Clear
        </button>
      </div>
      <p role="status">{status}</p>
      {results.map(({ index, text, result, error }) => (
        <article className="url-result" key={index}>
          <h3>
            <Link size={16} /> URL {index + 1}
          </h3>
          <label>
            Original URL
            <input readOnly value={text} />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            result && (
              <>
                <label>
                  Cleaned URL
                  <textarea
                    aria-label="Cleaned URL"
                    readOnly
                    value={result.cleaned}
                    rows={2}
                  />
                </label>
                {result.signed && (
                  <p className="warning">
                    This looks like a signed link. Removing parameters may
                    invalidate its signature.
                  </p>
                )}
                <button onClick={() => copy(result.cleaned)}>
                  <Copy size={14} />
                  Copy URL {index + 1}
                </button>
                <h4>Tracking parameters</h4>
                {!result.removed.length ? (
                  <p className="subtle">No known tracking parameters found.</p>
                ) : (
                  result.removed.map((p) => (
                    <label className="check" key={p.index}>
                      <input
                        type="checkbox"
                        checked={p.restored}
                        onChange={(e) =>
                          setRestored((v) => ({
                            ...v,
                            [index]: e.target.checked
                              ? [...(v[index] || []), p.index]
                              : (v[index] || []).filter((x) => x !== p.index),
                          }))
                        }
                      />
                      <span>
                        Restore <code>{p.name}</code> = {p.value || "(empty)"}{" "}
                        <small>{p.restored ? "Kept" : "Removed"}</small>
                      </span>
                    </label>
                  ))
                )}
              </>
            )
          )}
        </article>
      ))}
    </section>
  );
}
