# Multi-stage Dockerfile for smaller runtime image

FROM node:18-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production --no-audit --no-fund

COPY backend/. .
COPY frontend ./frontend

# Copy scripts from repo root
COPY scripts ./scripts

FROM node:18-alpine AS runner
WORKDIR /app

# bash + sqlite for backup scripts
RUN apk add --no-cache bash sqlite

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder /app /app

RUN mkdir -p /app/database /app/backups /app/scripts && \
    chmod -R +x /app/scripts && \
    chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http'); const req=http.get('http://127.0.0.1:3001/api/health', (r)=>process.exit(r.statusCode===200?0:1)); req.on('error', ()=>process.exit(1));"
CMD ["node", "src/server.js"]
 