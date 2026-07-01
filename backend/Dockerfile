# Development stage
FROM node:22-bookworm-slim AS development

WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install all dependencies, including devDependencies
RUN npm ci

# Copy source code
COPY . .


# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies required for building
RUN npm ci

# Copy face-api models into the runtime model directory
RUN mkdir -p /app/models/face-api \
    && cp /app/node_modules/@vladmandic/face-api/model/tiny_face_detector_model* \
    /app/models/face-api/ \
    && cp /app/node_modules/@vladmandic/face-api/model/face_landmark_68_tiny_model* \
    /app/models/face-api/ \
    && cp /app/node_modules/@vladmandic/face-api/model/face_recognition_model* \
    /app/models/face-api/

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build

# Reinstall production dependencies only
ENV NODE_ENV=production

RUN rm -rf node_modules \
    && npm ci --omit=dev \
    && npm cache clean --force


# Production stage
FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Debian-compatible non-root user creation
RUN groupadd --gid 1001 nodejs \
    && useradd \
    --uid 1001 \
    --gid nodejs \
    --shell /usr/sbin/nologin \
    --create-home \
    nestjs

# Create writable runtime folders
RUN mkdir -p /app/uploads /app/models/face-api \
    && chown -R nestjs:nodejs /app/uploads /app/models

# Copy production dependencies
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy compiled application
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

# Copy face-api models
COPY --from=build --chown=nestjs:nodejs /app/models ./models

# Copy package information
COPY --chown=nestjs:nodejs package*.json ./

# Run as non-root
USER nestjs

EXPOSE 80

CMD ["node", "dist/main.js"]