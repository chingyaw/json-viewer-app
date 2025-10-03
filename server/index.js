// Express reverse proxy to fetch JSON (e.g., JIRA attachment), attach Basic Auth, and stream response to client.
// CORS is solved by having the browser call this server's /api/fetch endpoint instead of the upstream JSON host.

import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import axios from "axios";
import cors from "cors";
import { URL } from "url";

dotenv.config();

const app = express();
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));
// Allow dev client to reach server; adjust origin as needed in real deployment.
app.use(cors({ origin: true, credentials: false }));

const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4000);
const JIRA_USERNAME = process.env.JIRA_USERNAME || "";
const JIRA_PASSWORD = process.env.JIRA_PASSWORD || "";
const ALLOWED_UPSTREAM = (process.env.ALLOWED_UPSTREAM || "").split("|").filter(Boolean);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 180000);
const MAX_BYTES_MB = Number(process.env.MAX_BYTES_MB || 500);

function isAllowedUpstream(urlStr) {
  try {
    const u = new URL(urlStr);
    return ALLOWED_UPSTREAM.some((host) => u.host.endsWith(host));
  } catch {
    return false;
  }
}

// Proxy endpoint to bypass CORS and attach auth if provided.
app.get("/api/fetch", async (req, res) => {
  const jsonUrl = req.query.url;
  if (!jsonUrl) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  if (!isAllowedUpstream(jsonUrl)) {
    return res.status(403).json({ error: "Upstream host is not allowed" });
  }

  const auth =
    JIRA_USERNAME && JIRA_PASSWORD
      ? "Basic " + Buffer.from(`${JIRA_USERNAME}:${JIRA_PASSWORD}`).toString("base64")
      : undefined;

  try {
    const upstream = await axios({
      method: "GET",
      url: jsonUrl,
      responseType: "stream",
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        ...(auth ? { Authorization: auth } : {}),
        "Accept": "application/json,*/*",
      },
      maxContentLength: MAX_BYTES_MB * 1024 * 1024,
      maxBodyLength: MAX_BYTES_MB * 1024 * 1024
    });

    const contentLength = upstream.headers["content-length"];
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Content-Type", upstream.headers["content-type"] || "application/json");
    res.setHeader("Cache-Control", "no-store");

    upstream.data.on("error", (e) => {
      res.destroy(e);
    });

    upstream.data.pipe(res);
  } catch (err) {
    const code = err.response?.status || 500;
    const detail = err.response?.statusText || err.message;
    res.status(code).json({ error: "Upstream fetch failed", detail });
  }
});

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, BIND_HOST, () => {
  console.log(`Server listening on http://${BIND_HOST}:${PORT}`);
});
