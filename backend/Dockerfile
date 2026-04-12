FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY src ./src

EXPOSE 8787
CMD ["pnpm", "start"]
