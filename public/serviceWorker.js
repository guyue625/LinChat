const FILE_CACHE = "chatgpt-next-web-file";
const OBSOLETE_APP_CACHE = "chatgpt-next-web-cache";
const APP_CACHE_PREFIX = "linchat-app-cache-";
const alphabet =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

function nanoid(size = 21) {
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let index = 0; index < size; index += 1) {
    id += alphabet[63 & bytes[index]];
  }
  return id;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name === OBSOLETE_APP_CACHE || name.startsWith(APP_CACHE_PREFIX),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
      console.log("ServiceWorker activated.");
    })(),
  );
});

function jsonify(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function upload(request, url) {
  const formData = await request.formData();
  const file = formData.getAll("file")[0];

  if (!(file instanceof File)) {
    return jsonify({ code: 1, message: "Missing file" }, { status: 400 });
  }

  let extension = file.name.split(".").pop();
  if (!extension || extension === "blob") {
    extension = file.type.split("/").pop() || "bin";
  }

  const fileUrl = `${url.origin}/api/cache/${nanoid()}.${extension}`;
  const cache = await caches.open(FILE_CACHE);
  await cache.put(
    new Request(fileUrl),
    new Response(file, {
      headers: {
        "content-type": file.type || "application/octet-stream",
        "content-length": String(file.size),
        "cache-control": "no-cache",
        server: "ServiceWorker",
      },
    }),
  );

  return jsonify({ code: 0, data: fileUrl });
}

async function read(request) {
  const cache = await caches.open(FILE_CACHE);
  const response = await cache.match(request);
  return response || new Response("Not found", { status: 404 });
}

async function remove(request) {
  const cache = await caches.open(FILE_CACHE);
  await cache.delete(request.url);
  return jsonify({ code: 0 });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isFileCacheRequest =
    url.origin === self.location.origin &&
    (url.pathname === "/api/cache" || url.pathname.startsWith("/api/cache/"));

  if (!isFileCacheRequest) return;

  if (event.request.method === "GET") {
    event.respondWith(read(event.request));
  } else if (event.request.method === "POST") {
    event.respondWith(upload(event.request, url));
  } else if (event.request.method === "DELETE") {
    event.respondWith(remove(event.request));
  }
});
