# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /workspace
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
ARG VITE_API_BASE_URL=/api
ARG VITE_AI_API_BASE_URL=/ai
ARG VITE_MAIN_APP_ORIGIN=http://localhost:8080
ARG VITE_ADMIN_APP_ORIGIN=http://localhost:8080
ARG VITE_GOOGLE_MAPS_API_KEY=
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_CLOUDINARY_CLOUD_NAME=
ARG VITE_CLOUDINARY_UPLOAD_PRESET=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_AI_API_BASE_URL=$VITE_AI_API_BASE_URL \
    VITE_MAIN_APP_ORIGIN=$VITE_MAIN_APP_ORIGIN \
    VITE_ADMIN_APP_ORIGIN=$VITE_ADMIN_APP_ORIGIN \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_CLOUDINARY_CLOUD_NAME=$VITE_CLOUDINARY_CLOUD_NAME \
    VITE_CLOUDINARY_UPLOAD_PRESET=$VITE_CLOUDINARY_UPLOAD_PRESET
RUN cd client && npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY ops/docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN nginx -t
COPY --from=build /workspace/client/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health/live || exit 1
