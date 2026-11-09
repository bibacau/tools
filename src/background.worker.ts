/// <reference lib="webworker" />
const nativeFetch = self.fetch.bind(self);
self.onmessage = async (
  e: MessageEvent<{ file: Blob; allowDownload: boolean }>,
) => {
  self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init),
      url = new URL(request.url);
    if (url.protocol === "blob:") return nativeFetch(request);
    if (
      url.origin !== self.location.origin &&
      url.origin !== "https://staticimgly.com"
    )
      throw Error("Unexpected model asset destination");
    const cache = await caches.open("personal-os-background-model-v1.7.0"),
      cached = await cache.match(request);
    if (cached) return cached;
    if (!e.data.allowDownload && url.origin !== self.location.origin)
      throw Error(
        "Model not cached. Enable optional internet features to download it first.",
      );
    const response = await nativeFetch(request, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw Error(
        "Model download failed (HTTP " +
          response.status +
          "). Check your connection and model host access.",
      );
    await cache.put(request, response.clone());
    return response;
  };
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(e.data.file, {
      model: "isnet_quint8",
      device: "cpu",
      proxyToWorker: false,
      publicPath:
        "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
      output: { format: "image/png", quality: 1 },
      progress: (key, current, total) =>
        self.postMessage({
          progress: total ? Math.round((current / total) * 100) : null,
          stage: key,
        }),
    });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
