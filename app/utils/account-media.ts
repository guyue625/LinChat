/** Resolve device-local attachments before sending an encrypted cloud snapshot. */
export async function materializeAccountMedia<T>(state: T): Promise<T> {
  const pending = new Map<string, Promise<string>>();
  async function visit(value: unknown): Promise<unknown> {
    if (typeof value === "string") {
      let local = value.startsWith("blob:");
      try {
        const url = new URL(value, window.location.origin);
        local ||=
          url.origin === window.location.origin &&
          url.pathname.startsWith("/api/cache/");
      } catch {
        /* Ordinary message text is not a URL. */
      }
      if (!local) return value;
      if (!pending.has(value))
        pending.set(
          value,
          (async () => {
            const response = await fetch(value, { credentials: "same-origin" });
            if (!response.ok)
              throw new Error("本地附件无法读取，尚未完成云端保存");
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("附件读取失败"));
              reader.readAsDataURL(blob);
            });
          })(),
        );
      return pending.get(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([key, item]) => [
            key,
            await visit(item),
          ]),
        ),
      );
    }
    return value;
  }
  return (await visit(state)) as T;
}
