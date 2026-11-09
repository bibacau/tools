const tracking = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
]);
export function cleanURL(input: string, restored: number[] = []) {
  const original = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(original);
  } catch {
    throw Error("Enter a complete HTTP or HTTPS URL, including https://.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname)
    throw Error("Only valid HTTP and HTTPS URLs are accepted.");
  const hash = original.indexOf("#"),
    fragment = hash < 0 ? "" : original.slice(hash),
    withoutHash = hash < 0 ? original : original.slice(0, hash),
    q = withoutHash.indexOf("?");
  const base = q < 0 ? withoutHash : withoutHash.slice(0, q),
    parts = q < 0 ? [] : withoutHash.slice(q + 1).split("&");
  const removed: {
    index: number;
    name: string;
    value: string;
    restored: boolean;
  }[] = [];
  const kept = parts.filter((part, index) => {
    const pair = new URLSearchParams(part),
      [name, value] = [...pair.entries()][0] || ["", ""];
    if (!/^utm_/i.test(name) && !tracking.has(name.toLowerCase())) return true;
    const restore = restored.includes(index);
    removed.push({ index, name, value, restored: restore });
    return restore;
  });
  const cleaned = removed.every((x) => x.restored)
    ? original
    : base + (kept.length ? "?" + kept.join("&") : "") + fragment;
  return {
    original,
    cleaned,
    removed,
    signed: [...parsed.searchParams.keys()].some((k) =>
      /signature|^sig$|^x-amz-|^x-goog-/i.test(k),
    ),
  };
}
