# WorkCloud CI/CD in simple terms

This project uses GitHub Actions for CI and publishing Docker images. This guide explains what happens and how to turn it on.

## CI and CD

- **CI** means GitHub checks proposed code changes automatically. It installs dependencies, runs tests, builds the client, checks the Python code, and builds all three Docker images.
- **CD** here means GitHub publishes versioned images to GitHub Container Registry (GHCR) when code is pushed to `main`. A published image is a ready-to-run package.
- Publishing images is not the same as deploying the app to a live server. A server, domain, HTTPS setup, and deployment credentials are still needed for automatic server deployment.

## What this project runs

The workflows are in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and [`.github/workflows/publish-images.yml`](../.github/workflows/publish-images.yml).

On a pull request, CI runs these checks:

1. Client dependencies install from `client/package-lock.json`; client tests and the Vite production build run.
2. API dependencies install from `server/package-lock.json`; API tests run.
3. AI dependencies install from `ai-service/requirements.txt`; Python files compile. Pytest runs if test modules exist.
4. Docker builds the web, API, and AI images. CI does not publish these test images.

When a change is pushed or merged to the `main` branch, the publish workflow builds and pushes three images to GHCR. Each image gets a commit SHA tag, which identifies the exact source revision, and a `latest` tag, which points to the most recently published `main` build.

The image names look like:

```text
ghcr.io/OWNER/REPOSITORY/workcloud-web:COMMIT_SHA
ghcr.io/OWNER/REPOSITORY/workcloud-api:COMMIT_SHA
ghcr.io/OWNER/REPOSITORY/workcloud-ai:COMMIT_SHA
```

Replace `OWNER`, `REPOSITORY`, and `COMMIT_SHA` with your GitHub account or organization, repository, and full commit SHA. For production rollback, prefer a specific SHA tag instead of `latest`.

## Set it up on GitHub

1. Put the project in a GitHub repository. GitHub Actions only sees files that have been committed and pushed.
2. Ensure the default branch is named `main`, or update both workflow files to use your actual default branch.
3. In the repository, open **Settings → Actions → General**. Allow GitHub Actions to run and set workflow permissions to **Read repository contents**. The publishing job separately requests permission to write packages.
4. Push the workflow files to GitHub. Open the **Actions** tab and watch the CI workflow. Fix any failing checks before merging.
5. Merge a change to `main`. Open **Actions** and confirm that **Publish container images** succeeds.
6. Open the repository's **Packages** area or the owner's GitHub Packages page and confirm the three images exist. If the packages should be public, change each package's visibility in its package settings. They may be private by default.

The workflows use GitHub's short-lived `GITHUB_TOKEN`. They do not need MongoDB credentials, API keys, `.env` files, or a personal access token. Do not add production secrets to CI just to build images.

## Use the published images

On a server that can access the packages, log in to GHCR if the packages are private, then pull the exact image tags. For example, in PowerShell:

```powershell
docker login ghcr.io
docker pull ghcr.io/OWNER/REPOSITORY/workcloud-web:COMMIT_SHA
docker pull ghcr.io/OWNER/REPOSITORY/workcloud-api:COMMIT_SHA
docker pull ghcr.io/OWNER/REPOSITORY/workcloud-ai:COMMIT_SHA
```

The production host still needs its own runtime environment file or secret manager. Do not put secrets in image build arguments, image tags, or committed files. The web image contains public `VITE_*` settings that were set at build time, so build with the correct public site origins and browser-safe values.

The current `compose.yaml` builds images locally. To run the published images on a server, provide a production Compose configuration that uses the three GHCR image references instead of local `build` blocks, and inject API/AI secrets from the host or its secret manager. Keep API and AI ports private, put HTTPS in front of web, and use managed database/storage services. The server provider and domain have not been selected in this repository, so this workflow stops after publishing images rather than attempting an unsafe or non-functional server deployment.

## Check a failed run

1. Open GitHub's **Actions** tab.
2. Select the failed workflow run and open the failed job.
3. Read the first command that failed; later failures may be consequences of it.
4. Reproduce the same check locally where possible: `npm run test:client`, `npm run test:api`, `npm run build`, or `docker compose --env-file .env.docker build`.
5. Fix the code, push another commit, and let CI run again.

Pull requests run tests and build images but do not publish packages. Only pushes to `main` (or a manual run of the publish workflow) publish images.
