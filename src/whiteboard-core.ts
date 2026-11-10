const allowed = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "triangle",
  "polygon",
  "polyline",
  "path",
  "textbox",
  "i-text",
  "text",
  "image",
  "group",
]);
export function validateBoardProject(value: any) {
  if (
    value?.format !== "personal-os-whiteboard" ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    !value.content?.canvas ||
    !Array.isArray(value.content.canvas.objects)
  )
    throw Error("Invalid Personal OS whiteboard project");
  if (JSON.stringify(value).length > 10 * 1048576)
    throw Error("Project exceeds the 10 MB limit");
  let nodes = 0;
  function safeTree(node: any, depth = 0) {
    if (depth > 30 || ++nodes > 200000) throw Error("Project is too complex");
    if (typeof node === "number" && !Number.isFinite(node))
      throw Error("Non-finite geometry");
    if (node && typeof node === "object")
      for (const [key, value] of Object.entries(node)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw Error("Unsafe project property");
        safeTree(value, depth + 1);
      }
  }
  safeTree(value);
  let count = 0;
  function visit(o: any, depth: number) {
    if (!o || typeof o !== "object" || depth > 8 || ++count > 2500)
      throw Error("Board contains too many or invalid objects");
    if (!allowed.has(String(o.type).toLowerCase()))
      throw Error("Unsupported whiteboard object type");
    if (
      o.src &&
      (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(o.src) ||
        o.src.length > 3 * 1048576)
    )
      throw Error("Images must be embedded PNG/JPG/WebP data, under 3 MB");
    if (
      (o.fill && typeof o.fill !== "string") ||
      (o.stroke && typeof o.stroke !== "string")
    )
      throw Error("Pattern/gradient imports are not supported");
    if (o.path?.length > 50000) throw Error("Drawing path is too complex");
    for (const key of ["__proto__", "constructor", "prototype"])
      if (Object.hasOwn(o, key)) throw Error("Unsafe object property");
    for (const key of [
      "left",
      "top",
      "width",
      "height",
      "scaleX",
      "scaleY",
      "angle",
      "opacity",
      "strokeWidth",
    ])
      if (
        o[key] !== undefined &&
        (!Number.isFinite(o[key]) || Math.abs(o[key]) > 1e7)
      )
        throw Error("Invalid object dimensions");
    if (
      o.fontFamily &&
      ![
        "Arial",
        "Georgia",
        "Courier New",
        "Verdana",
        "Times New Roman",
        "monospace",
        "sans-serif",
        "serif",
      ].includes(o.fontFamily)
    )
      throw Error("Unsupported font");
    if (o.clipPath) visit(o.clipPath, depth + 1);
    if (o.objects) {
      if (!Array.isArray(o.objects)) throw Error("Invalid group");
      o.objects.forEach((p: any) => visit(p, depth + 1));
    }
    if (o.filters?.length)
      throw Error("Image-filter imports are not supported");
  }
  value.content.canvas.objects.forEach((o: any) => visit(o, 0));
  for (const key of [
    "background",
    "backgroundColor",
    "overlay",
    "overlayColor",
  ])
    if (
      value.content.canvas[key] &&
      typeof value.content.canvas[key] !== "string"
    )
      throw Error("Unsupported canvas background");
  if (value.content.canvas.backgroundImage || value.content.canvas.overlayImage)
    throw Error("Use embedded image objects instead of external backgrounds");
  const v = value.content.viewport;
  if (
    v &&
    (!Array.isArray(v) ||
      v.length !== 6 ||
      v.some((n: any) => !Number.isFinite(n) || Math.abs(n) > 1e7) ||
      v[0] < 0.1 ||
      v[0] > 10 ||
      v[3] < 0.1 ||
      v[3] > 10)
  )
    throw Error("Invalid canvas viewport");
  return value;
}
