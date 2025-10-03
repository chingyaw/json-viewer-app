// Web Worker: parse JSON off the main thread to avoid freezing the UI for large payloads.
self.onmessage = (e) => {
  try {
    const text = e.data;
    const obj = JSON.parse(text);
    self.postMessage({ ok: true, data: obj });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};
