FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/planning.sqlite
ENV STATIC_DIR=/app/dist/planning-pro/browser
COPY --from=build /app/dist /app/dist
COPY server /app/server
EXPOSE 8080
CMD ["node", "server/index.mjs"]
