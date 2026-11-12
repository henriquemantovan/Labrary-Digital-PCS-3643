/** Um intervalo RFC 9110; valores inválidos recebem 416 no controller. */
export function parseByteRange(
  header: string,
  size: number,
): { start: number; end: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return undefined;
  const first = Number(match[1]),
    last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || size <= 0)
    return undefined;
  if (!match[1])
    return last > 0
      ? { start: Math.max(0, size - last), end: size - 1 }
      : undefined;
  if (first >= size || (match[2] && last < first)) return undefined;
  return { start: first, end: match[2] ? Math.min(last, size - 1) : size - 1 };
}
