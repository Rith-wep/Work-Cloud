# Docker workflow for WorkCloud

This guide explains how the Docker setup works and how to use it from a clean start. It is written for developers who are new to Docker.

## 1. The basic idea

Docker packages an application together with the runtime and libraries it needs. That package is called an **image**. When Docker starts an image, it creates a **container**. A container is a running copy of one service.

WorkCloud has three application services:

- **web**: the built React/Vite site, served by Nginx.
- **api**: the Express server, which connects to MongoDB and calls the AI service.
- **ai**: the FastAPI service.

Docker Compose reads `compose.yaml` and starts these services as one application. Compose also creates a network so the containers can find one another by service name. For example, the API reaches the AI service at `http://ai:8000`.

MongoDB Atlas and Cloudinary are external services. They do not run in this Compose setup.

## 2. Development mode and Docker mode

These are two ways to run the project:

| Mode | How the web app runs | Address | Good for |
| --- | --- | --- | --- |
| Development | Vite serves source files and reloads as you edit | `http://localhost:5173` | Daily coding |
| Docker | Vite builds static files; Nginx serves the built files | `http://localhost:8081` with the example settings | Checking a production-style package |

Port `5173` belongs to the Vite development server. Docker uses the host port in `WEB_PORT` (the provided example uses `8081`) and the container listens on port `8080`. You can change `WEB_PORT` if that host port is already in use.

Docker mode does not automatically copy your source edits into the running container. Rebuild the relevant image after changing code:

```powershell
docker compose --env-file .env.docker up --build
```

## 3. Before the first run

1. Install Docker Desktop and start it. Wait until Docker Desktop says the engine is running.
2. Open PowerShell in the project root, the folder containing `compose.yaml`.
3. Create the API environment file if you have not already:

   ```powershell
   Copy-Item server/.env.docker.example server/.env.docker
   ```

   Edit `server/.env.docker` and provide the API's required values, including a valid MongoDB connection string, database name, and authentication secrets. Keep this file private and do not commit it.

4. Create the Compose environment file:

   ```powershell
   Copy-Item .env.docker.example .env.docker
   ```

   Edit `.env.docker`. Set `API_ENV_FILE=./server/.env.docker`. Set `MONGODB_URI` and `MONGO_DB_NAME` for the AI service too. Replace all example placeholders with real values. Keep `.env.docker` private and do not commit it.

   These are two different files. The root `.env.docker` configures Compose and passes selected settings to the web and AI services. `server/.env.docker` supplies runtime settings to the API. Docker Compose does not automatically read every `.env` file in subfolders.

5. Check that the chosen web port is free. The example uses `WEB_PORT=8081`. If you use another port, update all public origin settings in `.env.docker` to match, such as `CLIENT_ORIGINS`, `ADMIN_ORIGINS`, `AI_CORS_ORIGINS`, `VITE_MAIN_APP_ORIGIN`, and `VITE_ADMIN_APP_ORIGIN`.

   Values beginning with `VITE_` are compiled into browser files. They are public; never put passwords, database URLs, or private API secrets in them.

## 4. Start WorkCloud

Run from the project root:

```powershell
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up --build
```

The first command checks and prints the resolved Compose configuration. Review it for missing values or unintended ports. Do not share the output if it contains secrets.

The second command builds images if needed, creates the Docker networks, starts the services in dependency order, and attaches the terminal to their logs. The first build may take several minutes while dependencies are downloaded. Keep this terminal open while using the app.

When the API and AI report healthy and the web service stays running, open:

- Main app: `http://localhost:8081/`
- Admin app: `http://localhost:8081/admin.html`

Use the port set in your `.env.docker` if it differs from `8081`.

## 5. How a browser request reaches a service

The browser contacts the web container through the published host port. Nginx serves the built site and forwards API requests:

```text
Browser -> localhost:WEB_PORT -> Nginx (web)
                                  |-- /api/ai/... -> ai:8000
                                  |-- /api/...    -> api:5000
                                  `-- /socket.io/ -> api:5000
```

Only the web service publishes a port to your computer. The API and AI ports are available to other containers on the Compose network but are not directly published to the internet or host. The API and AI still need outbound network access to reach MongoDB Atlas and other configured providers.

## 6. Health checks and common errors

Docker runs a health check inside each image to see whether its service can answer requests. Compose waits for API and AI to become healthy before starting web. A process can be running while still being unhealthy; check the health endpoint and service logs to find out why.

Useful commands:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100
docker compose --env-file .env.docker logs --tail 100 web
docker compose --env-file .env.docker logs --tail 100 api
docker compose --env-file .env.docker logs --tail 100 ai
```

Common messages:

- **Port is already allocated / ports are not available**: another app or container is using `WEB_PORT`. Stop the other listener or choose a free port in `.env.docker`. Make the public origin settings use that same port, then recreate the containers.
- **`MONGODB_URI is not configured`**: check `server/.env.docker` for the API and root `.env.docker` for the AI service. Confirm `API_ENV_FILE` points to the API file.
- **API is unhealthy**: read API logs and check that MongoDB is reachable and its credentials/database settings are correct. The API readiness URL is `/api/health/ready` inside the Compose network.
- **AI is unhealthy**: read AI logs and check its environment and dependencies. Its live health URL is `/health/live` inside the Compose network.
- **Web exits during Nginx startup**: inspect `docker compose ... logs web`. The web container uses a non-root Nginx process and temporary writable paths; do not remove the `tmpfs` configuration without understanding the permissions impact.
- **Docker daemon connection error**: start Docker Desktop and wait for the engine to become ready, then retry.

`Ctrl+C` stops the foreground `up` command. To stop the containers and remove the Compose networks, run:

```powershell
docker compose --env-file .env.docker down
```

This does not delete images or data stored in external services. Avoid `docker compose down -v` unless you understand which volumes it removes.

## 7. The files to review, in order

Follow this order to understand how the setup is connected:

1. [`compose.yaml`](../compose.yaml) — services, build contexts, networks, environment variables, health dependencies, and published ports. Start here to see the whole deployment.
2. [`.env.docker.example`](../.env.docker.example) — the safe template for local Compose settings. Your private `.env.docker` is based on this file.
3. [`server/.env.docker.example`](../server/.env.docker.example) — the API runtime settings template. Your private `server/.env.docker` is based on this file.
4. [`ops/docker/client.Dockerfile`](../ops/docker/client.Dockerfile) — builds the Vite app, then copies only its static output into Nginx.
5. [`ops/docker/nginx.conf`](../ops/docker/nginx.conf) — serves browser files and routes API, AI, and Socket.IO requests.
6. [`ops/docker/api.Dockerfile`](../ops/docker/api.Dockerfile) — installs production Node dependencies and starts Express as a non-root user.
7. [`ops/docker/ai.Dockerfile`](../ops/docker/ai.Dockerfile) — installs Python dependencies and starts FastAPI as a non-root user.
8. [`.dockerignore`](../.dockerignore) — excludes local dependencies, build output, tests, and secret environment files from Docker build contexts.
9. [`docker.md`](docker.md) — production deployment checklist and recommendations.

After understanding these, read [`architecture.md`](architecture.md) for the application layout and [`deployment.md`](deployment.md) for non-Docker deployment options.

## 8. A normal developer workflow

For everyday feature work, use the development commands in the root `README.md`, especially the Vite client at port `5173`. This gives fast reloads. Run Docker when you want to check the production-style build, verify service networking, or reproduce a container issue.

After changing the client, API, AI service, Dockerfiles, or Nginx config, rebuild and restart:

```powershell
docker compose --env-file .env.docker up --build
```

When you finish:

```powershell
docker compose --env-file .env.docker down
```

For a deployed production environment, do not use developer placeholder credentials or the local `.env.docker` as a secrets system. Build and tag images in CI, store secrets in the deployment platform, use HTTPS, and use managed database and storage services with backups and access controls. See [`docker.md`](docker.md) for the production checklist.
