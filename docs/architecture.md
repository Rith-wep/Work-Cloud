# Architecture

WorkCloud is a monorepo with three services: a React/Vite client, an Express/MongoDB API, and a FastAPI AI service.

- `client/src/app`: browser entry points, route setup, providers, and global styles.
- `client/src/features`: pages and components grouped by product domain.
- `client/src/shared`: reusable components, contexts, and utilities.
- `server/src/features`: API routes, controllers, models, and domain logic by feature.
- `server/src/infrastructure`: database, cloud storage, and logging adapters.
- `server/src/shared`: middleware, shared utilities, sockets, and scripts.
- `ai-service/app`: Python API and AI service modules.

Feature modules are the active structure; use the original application logic guide for current routes and feature behavior.

