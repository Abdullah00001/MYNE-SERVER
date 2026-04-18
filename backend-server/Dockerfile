# ============================================
# Stage 1: Build Stage
# ============================================
FROM node:22.14.0-alpine AS builder

# Install build dependencies
RUN apk add --no-cache bash

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and build scripts
COPY . .

# Make build script executable
RUN chmod +x ./scripts/build.sh

# Build the application
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# ============================================
# Stage 2: Production Stage
# ============================================
FROM node:22.14.0-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /usr/src/app

# Copy only production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist

# Copy package.json for metadata
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/package.json ./

RUN mkdir -p logs && chown -R nodejs:nodejs logs  

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]