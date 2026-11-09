import { parse } from "mathjs";
const functions = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "abs",
  "log",
  "log10",
  "exp",
  "floor",
  "ceil",
  "round",
  "sinh",
  "cosh",
]);
export function expression(source: string) {
  if (source.length > 250) throw Error("Expression is too long");
  const node = parse(source);
  let count = 0;
  node.traverse((n) => {
    if (++count > 100) throw Error("Expression is too complex");
    if (
      ![
        "OperatorNode",
        "ConstantNode",
        "SymbolNode",
        "FunctionNode",
        "ParenthesisNode",
      ].includes(n.type)
    )
      throw Error("Only mathematical expressions are supported");
    if (
      n.type === "SymbolNode" &&
      !["x", "pi", "e", ...functions].includes((n as any).name)
    )
      throw Error("Unknown variable: " + (n as any).name);
    if (n.type === "FunctionNode" && !functions.has((n as any).fn.name))
      throw Error("Unsupported function");
    if (
      n.type === "OperatorNode" &&
      !["+", "-", "*", "/", "^", "%"].includes((n as any).op)
    )
      throw Error("Unsupported operator");
  });
  const compiled = node.compile();
  return (x: number) => {
    const y = compiled.evaluate({ x });
    return typeof y === "number" && Number.isFinite(y) ? y : null;
  };
}
