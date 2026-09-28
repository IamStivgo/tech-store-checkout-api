# API image: TypeScript build, production dependencies only and a non-root runtime.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# No lifecycle scripts: they only install the git hooks.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
