export const racePassages = [
  "A little focus goes a long way. Find your rhythm, follow the words, and enjoy the ride. Every small step is progress.",
  "Beyond the quiet forest, a narrow path leads to a bright little village. The morning light makes every window shine.",
  "Good ideas begin with curiosity. Give yourself the space to explore, make a few mistakes, and try something new today.",
];
export function raceStats(typed: string, passage: string, elapsedMs: number) {
  const typedChars = Array.from(typed),
    passageChars = Array.from(passage);
  const correct = typedChars.filter((c, i) => c === passageChars[i]).length;
  let prefix = 0;
  while (
    prefix < typedChars.length &&
    typedChars[prefix] === passageChars[prefix]
  )
    prefix++;
  return {
    wpm: elapsedMs > 0 ? correct / 5 / (elapsedMs / 60000) : 0,
    accuracy: typedChars.length ? (correct / typedChars.length) * 100 : 100,
    progress: passageChars.length ? prefix / passageChars.length : 0,
    complete: typed === passage,
  };
}
