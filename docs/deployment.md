# Deployment

Build the browser application from `client/` with `npm run build`. Deploy both HTML entries and configure SPA fallback rules as documented in `client/DEPLOYMENT.md`.

Run the API with `npm --prefix server start`. Set database, JWT, CORS, cloud storage, payment, and OAuth configuration through the hosting platform's environment settings. Do not deploy local `.env` files.

Run the AI API with `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` from the repository root after installing `ai-service/requirements.txt`. Set allowed origins and AI credentials through the hosting platform's environment settings.

For a container deployment, use [Docker deployment](docker.md). For non-containerized frontend hosting, see [client deployment notes](../client/DEPLOYMENT.md).
