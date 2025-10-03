# JSON Viewer App (POC)

React (Vite) + Node (Express) reverse-proxy to load large JSON (e.g., JIRA attachment), bypass CORS, and display via jsoneditor.
- Back-end attaches Basic Auth from server-side env vars.
- Front-end shows progress bar and parses in Web Worker to avoid UI freezes.

## Quick Start (Dev)
1) Install Node 18/20.
2) Install deps:
   - `npm -w server i`
   - `npm -w client i`
3) Configure server env: create `server/.env` from `.env.example`.
4) Start server and client (two terminals):
   - `npm -w server start`
   - `npm -w client run dev`
5) Open http://localhost:5173/?json_location=<ENCODED_JSON_URL>

## Build (Client)
- `npm -w client run build`

## Deploy (Sketch)
- Serve `client/dist` with Nginx, and proxy `/api/` to the Node server bound on 127.0.0.1:4000.
- Keep credentials only in `server/.env`.
