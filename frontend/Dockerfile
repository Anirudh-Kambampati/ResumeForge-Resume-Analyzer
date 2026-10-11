# Next.js frontend image, built in three stages. Only the last stage ends up in
# the final image, so build tools and dev dependencies are left behind.
# Build: docker build -t resumeforge-frontend ./frontend
# Run:   docker run -p 3000:3000 resumeforge-frontend

# --- Stage 1: install dependencies -------------------------------------------
FROM node:24-slim AS deps
WORKDIR /app
# Copy only the manifests first so this layer is cached until they change.
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: build the app --------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are baked into the browser JavaScript at build time,
# so they are build arguments, not runtime settings. The default works because
# the browser runs on your machine, where the backend is published on 8000.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_API_SECRET_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_SECRET_KEY=$NEXT_PUBLIC_API_SECRET_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Stage 3: the image that actually runs -----------------------------------
FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `output: "standalone"` (next.config.ts) makes Next produce a minimal server
# with just the node_modules it needs. Static assets are copied next to it.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# The official Node image ships with an unprivileged "node" user.
USER node
EXPOSE 3000
CMD ["node", "server.js"]
