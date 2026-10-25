# WorkCloud

WorkCloud is a full-stack opportunities platform maintained as a monorepo with a React/Vite client, Express/MongoDB API, and FastAPI AI service.

## Development

- Install dependencies separately with `npm --prefix client install` and `npm --prefix server install`.
- Client: `npm run dev:client`
- API: `npm run dev:api`
- AI API: install `ai-service/requirements.txt`, then run `uvicorn main:app --reload --port 8000 --app-dir ai-service/app`.

Copy `client/.env.example` and `server/.env.example` to local `.env` files and supply values. Do not commit credentials.

## Verification

- Production client build: `npm run build`
- Client tests: `npm run test:client`
- API tests: `npm run test:api`

GitHub Actions runs these checks on pull requests and publishes Docker images from `main`; see the [CI/CD guide](docs/ci-cd.md).

See [architecture](docs/architecture.md), [deployment](docs/deployment.md), the [Docker production guide](docs/docker.md), the beginner-friendly [Docker workflow guide](docs/docker-workflow.md), and the [CI/CD guide](docs/ci-cd.md).

Product behavior and feature rules are documented in [APP_LOGIC.md](docs/APP_LOGIC.md).
