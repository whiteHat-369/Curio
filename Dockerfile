# Multi-stage production Dockerfile for Curio Full-Stack Application

# ── Stage 1: Build Backend ──
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Build Frontend ──
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# ── Stage 3: Production Runtime ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install backend production dependencies
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd backend && npm ci --only=production && npx prisma generate

# Copy built backend files
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy built frontend assets
COPY --from=frontend-builder /app/.output ./frontend/dist

# Copy entrypoint script
COPY backend/docker-entrypoint.sh ./backend/
RUN chmod +x ./backend/docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

WORKDIR /app/backend
ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
