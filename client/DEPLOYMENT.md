# Frontend Deployment

## Environment Variables

Set these in both local `.env` and your deployment platform:

```env
VITE_API_BASE_URL=https://api.workcloud.com/api
VITE_AI_API_BASE_URL=https://ai.workcloud.com
VITE_MAIN_APP_ORIGIN=https://workcloud.com
VITE_ADMIN_APP_ORIGIN=https://admin.workcloud.com
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=profiles
```

## Build Output

The Vite build emits two entry points:

- `index.html` for the main candidate/employer app
- `admin.html` for the admin shell

## Host Routing

- `workcloud.com` should serve `index.html`
- `admin.workcloud.com` should serve `admin.html`

Runtime fallback is implemented in:

- `src/app/main.jsx`
- `src/app/admin-main.jsx`

These redirect users to the correct hostname if the wrong entry is opened.

## Separate-domain hosting (optional)

The Docker deployment uses one host for both entries; the examples below apply only if the main app and admin app are deployed on separate domains.

### Vercel

Use separate projects or separate domains with rewrites:

- Main app rewrite all routes to `index.html`
- Admin app rewrite all routes to `admin.html`

Example main rewrite:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Example admin rewrite:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/admin.html" }]
}
```

### Netlify

Main app:

```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

Admin app:

```toml
[[redirects]]
from = "/*"
to = "/admin.html"
status = 200
```

## Local Development

- Main app: `npm run dev`
- Admin app entry: `npm run dev:admin`

Local admin routing uses `HashRouter` from `admin.html` to avoid dev-server rewrite conflicts.

For the recommended container setup, see [../docs/docker.md](../docs/docker.md).

