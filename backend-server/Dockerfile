FROM node:22.14.0-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache bash

COPY package*.json ./
RUN npm ci

COPY . .
RUN chmod +x ./scripts/build.sh && npm run build
RUN npm prune --omit=dev

FROM node:22.14.0-alpine

RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /usr/src/app

COPY --from=builder --chown=nodejs:nodejs /usr/src/app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/public ./public

RUN mkdir -p logs && chown -R nodejs:nodejs logs

USER nodejs

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]