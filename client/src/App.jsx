import React, { useEffect, useRef, useState } from "react";
import JSONEditor from "jsoneditor";
import "jsoneditor/dist/jsoneditor.css";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export default function App() {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [mode, setMode] = useState("text"); // default to text mode for huge JSON
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [message, setMessage] = useState("");
  const [rawText, setRawText] = useState("");

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;
    editorRef.current = new JSONEditor(containerRef.current, {
      mode: mode,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
      onModeChange: (newMode) => setMode(newMode)
    });
    return () => editorRef.current?.destroy();
  }, []);

  // Handle mode switch content
  useEffect(() => {
    if (!editorRef.current) return;
    try {
      if (mode === "text") {
        editorRef.current.setText(rawText ?? "");
      } else {
        if (rawText) {
          try {
            const obj = JSON.parse(rawText);
            editorRef.current.set(obj);
          } catch (e) {
            editorRef.current.setText(rawText);
            setMode("text");
            setMessage(`Parse error: ${e.message}`);
          }
        }
      }
    } catch (e) {
      setMessage(`Editor error: ${e.message}`);
    }
  }, [mode]); // eslint-disable-line

  // On mount: auto load ?json_location=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jsonUrl = params.get("json_location");
    if (jsonUrl) {
      fetchJson(jsonUrl);
    } else {
      setMessage("Tip: provide ?json_location=<encoded URL> to auto-load.");
    }
  }, []);

  async function fetchJson(targetUrl) {
    setLoading(true);
    setProgressPct(0);
    setMessage("");
    setRawText("");

    const endpoint = `${API_BASE}/fetch?url=${encodeURIComponent(targetUrl)}`;

    try {
      const resp = await fetch(endpoint, { method: "GET" });
      if (!resp.ok) {
        const err = await safeJson(resp);
        throw new Error(err?.detail || resp.statusText);
      }

      const total = Number(resp.headers.get("Content-Length") || 0);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      let chunks = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        chunks += decoder.decode(value, { stream: true });
        if (total) setProgressPct(Math.min(100, Math.floor((received / total) * 100)));
      }

      const finalText = chunks + decoder.decode();
      setRawText(finalText);
      setProgressPct(100);

      const worker = new Worker(new URL("./JsonWorker.js", import.meta.url), { type: "module" });
      const parsePromise = new Promise((resolve) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.postMessage(finalText);
      });
      const result = await parsePromise;
      worker.terminate();

      if (result.ok) {
        if (editorRef.current) {
          editorRef.current.updateText(finalText);
        }
        setMessage(`Loaded ${bytesToHuman(received || finalText.length)}. You can switch to "tree" mode (may be heavy).`);
      } else {
        editorRef.current?.setText(finalText);
        setMessage(`JSON parse error: ${result.error}. Showing raw text.`);
      }
    } catch (e) {
      setMessage(`Fetch failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function onLoadClick() {
    const url = prompt("Enter JSON URL (JIRA attachment URL supported):");
    if (url) fetchJson(url.trim());
  }

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={onLoadClick}>Load JSON URL</button>
        <button onClick={() => setMode("text")} disabled={mode === "text"}>Text mode</button>
        <button onClick={() => setMode("tree")} disabled={mode === "tree"}>Tree mode</button>
        {loading ? <span className="spinner" title="Loading..." /> : null}
        {message ? <span className="warn" style={{ marginLeft: 12 }}>{message}</span> : null}
      </div>
      {loading ? (
        <div className="progress">
          <div style={{ width: `${progressPct}%` }} />
        </div>
      ) : null}
      <div className="editor" ref={containerRef} />
    </div>
  );
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return null; }
}

function bytesToHuman(n) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}
