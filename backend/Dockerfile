# Multi-stage Dockerfile for smaller runtime image

# ---- Builder: install production deps ----
FROM node:18-alpine AS builder
WORKDIR /app

# Install only production deps
COPY backend/package*.json ./
RUN npm ci --production

# Copy backend app source and frontend into image
COPY backend/. .
COPY frontend ./frontend

# ---- Runner: minimal final image ----
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy installed node_modules and app files from builder
COPY --from=builder /app /app

# Ensure directories and ownership
RUN mkdir -p /app/database /app/backups && \
    chown -R nodejs:nodejs /app

# Switch to non-root user for security
USER nodejs

# Expose runtime port
EXPOSE 3001

# Health check (container must respond on /api/health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if(r.statusCode!==200)throw new Error('Not healthy')})"

# Start application
CMD ["node", "src/server.js"]