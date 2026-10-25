# Docker and production deployment

New to Docker? Start with the [WorkCloud Docker workflow guide](docker-workflow.md). For automated tests and image publishing, see the [CI/CD guide](ci-cd.md).

## What Docker does here

Docker builds a versioned image for each service with its runtime and dependencies. Compose runs the images together on a private network and gives the web proxy stable service names for the API and AI service. This makes local development and deployments repeatable; Compose itself is a deployment tool for a single host, not a managed autoscaling platform.

## Services

- `web`: multi-stage Vite build served by Nginx. It is the only published container port.
- `api`: Express API and Socket.IO, available to other Compose services but not published on a host port.
- `ai`: FastAPI service, also not published on a host port. The API calls it at `http://ai:8000`.
- MongoDB Atlas and Cloudinary remain external managed services. Container filesystems are disposable; do not store uploads or database data inside a container.

The Nginx proxy sends `/api/ai/*` to FastAPI and the remaining `/api/*` plus `/socket.io/*` traffic to Express. This preserves the endpoint paths the current client and API code use. The browser calls both services on the same origin. API and AI need outbound network access for Atlas, Cloudinary, and external providers; they are not exposed on host ports.

## Local Docker run

1. Make sure Docker Desktop or the Docker Engine is running.
2. Copy `server/.env.docker.example` to `server/.env.docker` and replace placeholders with valid local development credentials. Never put real secrets in an image or commit an env file. On PowerShell: `Copy-Item server/.env.docker.example server/.env.docker`.
3. Copy `.env.docker.example` to `.env.docker`, set `API_ENV_FILE=./server/.env.docker`, set `MONGODB_URI` to your actual URI for the AI service, and adjust client build-time public settings as needed.
4. Validate and start:

   ```sh
   docker compose --env-file .env.docker config
   docker compose --env-file .env.docker up --build
   ```

5. Open the host and port configured by `WEB_PORT` in `.env.docker` (the example uses `http://localhost:8081`); the admin app is served from `/admin.html` on the same host. Set the `*_ORIGINS` and `VITE_*_ORIGIN` values to the same origin if you change `WEB_PORT`.
6. Stop with `docker compose --env-file .env.docker down`.

`server/.env.docker` is passed to the API at runtime. The AI service receives only `MONGODB_URI` and its CORS setting. The `.dockerignore` excludes env files from every image build context.

## Production rollout

1. Build and test images in CI for each commit; publish immutable tags such as the Git commit SHA to a private container registry. Avoid relying on `latest`.
2. Use a production Compose env file outside the repository or inject settings from the host's secret manager. Set `API_ENV_FILE` to the production env file path and supply the correct external app origins.
3. Build with production Vite settings. Vite `VITE_*` values are embedded into public browser JavaScript, so only use non-secret, browser-safe values there. API keys exposed to browsers must be restricted by their provider.
4. Terminate TLS at a managed load balancer or reverse proxy in front of the `web` service. Publish only that edge; keep API and AI off the public host ports.
5. Use a managed MongoDB deployment with backups, least-privilege credentials, TLS, and network access controls. Use Cloudinary or another durable object store for uploads.
6. Configure deployment health monitoring on `/health/live` at web and AI, and `/api/health/ready` on API. Configure log collection, alerts, backup restore drills, and a rollback to the last known image tags.
7. For high availability or autoscaling across hosts, move these images to a managed container service or Kubernetes. Compose on one host has a single-host failure boundary.

Use separate staging and production configuration, rotate credentials, and review image vulnerabilities before releases. Docker's official guidance covers [build best practices](https://docs.docker.com/build/building/best-practices/), [multi-stage builds](https://docs.docker.com/get-started/docker-concepts/building-images/multi-stage-builds/), and [Compose in production](https://docs.docker.com/compose/how-tos/production/).
