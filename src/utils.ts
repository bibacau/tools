export function download(
  name: string,
  content: string | Blob,
  type = "text/plain",
) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const copy = (text: string) => navigator.clipboard.writeText(text);
export const uid = () => crypto.randomUUID();
export function weightedIndex(weights: number[], random = Math.random()) {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (!total) throw Error("Add a positive weight");
  let p = random * total;
  for (let i = 0; i < weights.length; i++) {
    p -= Math.max(0, weights[i]);
    if (p < 0) return i;
  }
  return weights.length - 1;
}
export const cps = (clicks: number, seconds: number) => clicks / seconds;
export function typingStats(typed: string, target: string, seconds: number) {
  const correct = [...typed].filter((c, i) => c === target[i]).length;
  return {
    wpm: seconds ? correct / 5 / (seconds / 60) : 0,
    raw: seconds ? typed.length / 5 / (seconds / 60) : 0,
    accuracy: typed.length ? (correct / typed.length) * 100 : 100,
    errors: typed.length - correct,
  };
}
export const currency = (amount: number, rate: number) => amount * rate;
