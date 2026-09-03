export function unifiedDiff(fromText: string, toText: string, fromLabel: string, toLabel: string): string {
  const a = fromText.split("\n");
  const b = toText.split("\n");
  const lines: string[] = [`--- ${fromLabel}`, `+++ ${toLabel}`];
  const max = Math.max(a.length, b.length);
  let hunk: string[] = [];
  let start = 0;
  const flush = (end: number) => {
    if (hunk.length === 0) return;
    lines.push(`@@ -${start + 1},${end - start} +${start + 1},${end - start} @@`);
    lines.push(...hunk);
    hunk = [];
  };
  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      if (hunk.length) flush(i);
      continue;
    }
    if (hunk.length === 0) start = i;
    if (left !== undefined) hunk.push(`-${left}`);
    if (right !== undefined) hunk.push(`+${right}`);
  }
  flush(max);
  return lines.join("\n");
}
