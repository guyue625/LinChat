(() => {
  if (!("serviceWorker" in navigator)) return;

  const RECOVERY_KEY = "linchat-static-recovery";
  const RECOVERY_COOLDOWN_MS = 30_000;
  const NEXT_STATIC_PATH = "/_next/static/";
  let recoveryStarted = false;

  function isNextStaticUrl(value) {
    if (!value) return false;

    try {
      return new URL(value, window.location.href).pathname.startsWith(
        NEXT_STATIC_PATH,
      );
    } catch {
      return String(value).includes(NEXT_STATIC_PATH);
    }
  }

  function isChunkLoadError(reason) {
    const message = String(reason?.message || reason || "");
    return (
      reason?.name === "ChunkLoadError" ||
      /Loading (CSS )?chunk [^ ]+ failed/i.test(message) ||
      /Failed to fetch dynamically imported module/i.test(message) ||
      (message.includes(NEXT_STATIC_PATH) && /failed|error/i.test(message))
    );
  }

  function recentlyRecovered() {
    try {
      const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY));
      return (
        Number.isFinite(lastRecovery) &&
        Date.now() - lastRecovery < RECOVERY_COOLDOWN_MS
      );
    } catch {
      return recoveryStarted;
    }
  }

  function markRecovery() {
    recoveryStarted = true;
    try {
      sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    } catch {
      // sessionStorage may be unavailable in privacy-restricted contexts.
    }
  }

  async function recoverFromStaleAssets(source) {
    if (recoveryStarted || recentlyRecovered()) return;
    markRecovery();

    console.warn(
      `[ServiceWorker] Recovering from stale Next.js assets (${source}).`,
    );

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(
              (name) =>
                name === "chatgpt-next-web-cache" ||
                name.startsWith("linchat-app-cache-"),
            )
            .map((name) => caches.delete(name)),
        );
      }
    } catch (error) {
      console.warn("[ServiceWorker] Stale asset cleanup failed:", error);
    }

    // Preserve chatgpt-next-web-file: it contains user-uploaded local files.
    const reloadUrl = new URL(window.location.href);
    reloadUrl.searchParams.set("_linchat_recover", String(Date.now()));
    window.location.replace(reloadUrl.toString());
  }

  // Resource load failures do not bubble, so listen during the capture phase.
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      const resourceUrl = target?.src || target?.href;
      if (isNextStaticUrl(resourceUrl)) {
        void recoverFromStaleAssets("static resource load failure");
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      void recoverFromStaleAssets("chunk load failure");
    }
  });

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register(
        "/serviceWorker.js",
        { updateViaCache: "none" },
      );
      window._SW_ENABLED = true;
      console.log(
        "ServiceWorker registration successful with scope:",
        registration.scope,
      );

      // Check for updates without forcing reloads. The worker only owns /api/cache,
      // so controller changes do not require refreshing the application shell.
      await registration.update();
    } catch (error) {
      console.error("ServiceWorker registration failed:", error);
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", registerServiceWorker, {
      once: true,
    });
  } else {
    void registerServiceWorker();
  }
})();
