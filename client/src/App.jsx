import React, { useEffect, useRef, useState } from "react";
import JSONEditor from "jsoneditor";
import "jsoneditor/dist/jsoneditor.css";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export default function App() {
    const containerRef = useRef(null);
    const editorRef = useRef(null);
    const [rawText, setRawText] = useState("");

    // Initialize JSONEditor once
    useEffect(() => {
        if (!containerRef.current) return;
        editorRef.current = new JSONEditor(containerRef.current, {
            mode: "tree",          // Default mode: tree
            mainMenuBar: true,     // Allow switching between text/tree
            navigationBar: true,
            statusBar: true
        });
        return () => editorRef.current?.destroy();
    }, []);

    // On mount: read ?json_url= (preferred) or ?json_location= (legacy)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const jsonUrl = params.get("json_url") || params.get("json_location");
        if (jsonUrl) {
            fetchJson(jsonUrl);
        } else {
            if (editorRef.current) {
                editorRef.current.setText(
                    JSON.stringify({ error: "Missing ?json_url parameter" }, null, 2)
                );
            }
        }
    }, []);

    // Fetch JSON from backend proxy
    async function fetchJson(targetUrl) {
        try {
            const endpoint = `${API_BASE}/fetch?url=${encodeURIComponent(targetUrl)}`;
            const resp = await fetch(endpoint, { method: "GET" });
            if (!resp.ok) {
                const err = await safeJson(resp);
                throw new Error(err?.detail || resp.statusText);
            }
            const text = await resp.text();
            setRawText(text);

            // Try to parse JSON, if fails show raw text
            try {
                const obj = JSON.parse(text);
                editorRef.current?.set(obj);
            } catch (e) {
                editorRef.current?.setText(text);
            }
        } catch (e) {
            // Show error message inside the editor
            editorRef.current?.setText(
                JSON.stringify({ error: e.message }, null, 2)
            );
        }
    }

    return <div style={{ height: "100vh" }} ref={containerRef} />;
}

// Try parsing JSON safely
async function safeJson(resp) {
    try {
        return await resp.json();
    } catch {
        return null;
    }
}
