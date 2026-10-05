/** Apply local edits since the last server snapshot onto the latest server chat. */
export function mergeServerChat<T>(base: T, local: T, remote: T): T {
  if (JSON.stringify(base) === JSON.stringify(local)) return remote;
  if (JSON.stringify(base) === JSON.stringify(remote)) return local;

  const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const identified = (value: unknown): value is Array<{ id: string }> =>
    Array.isArray(value) &&
    value.every((item) => record(item) && typeof item.id === "string");

  if (identified(base) && identified(local) && identified(remote)) {
    const before = new Map(base.map((item) => [item.id, item]));
    const mine = new Map(local.map((item) => [item.id, item]));
    const theirs = new Map(remote.map((item) => [item.id, item]));
    const ids = new Set([...theirs.keys(), ...mine.keys()]);
    const result = [];
    for (const id of ids) {
      const previous = before.get(id);
      const current = mine.get(id);
      const latest = theirs.get(id);
      // Either side's deletion wins over edits to the deleted entity.
      if (previous && (!current || !latest)) continue;
      result.push(
        current && latest
          ? mergeServerChat(previous, current, latest)
          : current ?? latest,
      );
    }
    return result as T;
  }

  if (record(base) && record(local) && record(remote)) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ])) {
      const value = mergeServerChat(base[key], local[key], remote[key]);
      if (value !== undefined) result[key] = value;
    }
    return result as T;
  }
  return local;
}
