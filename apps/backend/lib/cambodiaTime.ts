export function cambodiaDayRange(now = new Date()) {
  const cambodiaOffsetMs = 7 * 60 * 60 * 1000;
  const cambodiaNow = new Date(now.getTime() + cambodiaOffsetMs);
  const start = new Date(
    Date.UTC(
      cambodiaNow.getUTCFullYear(),
      cambodiaNow.getUTCMonth(),
      cambodiaNow.getUTCDate()
    ) - cambodiaOffsetMs
  );

  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
