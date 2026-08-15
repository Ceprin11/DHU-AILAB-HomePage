# AGENTS.md

## Project Context

This is a self-hosted React and Express website for the DHU AILAB laboratory. Keep changes focused and preserve the existing frontend design unless the user requests otherwise.

## Key Files

- `src/`: React frontend source.
- `src/api/client.js`: frontend API client.
- `server/index.js`: Express server, authentication, uploads, and static hosting.
- `server/store.js`: JSON data storage and entity validation.
- `data/`: runtime data and uploads; never commit it.
- `.env`: production secrets; never commit it.

## Local Workflow

- `npm run dev`: run the API and Vite development middleware on one port.
- `npm run build`: build the frontend into `dist/`.
- `npm start`: serve the production API and built frontend.
- Run relevant checks from `package.json` before finishing changes.

## Deployment

Production requires Node.js 18+, a writable persistent `data/` directory, and strong `ADMIN_PASSWORD` and `SESSION_SECRET` environment values. Prefer HTTPS through a reverse proxy.
