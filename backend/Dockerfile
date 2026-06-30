# Development stage
FROM node:22-bookworm-slim AS development

WORKDIR /app

# Copy ONLY package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code AFTER installing dependencies
COPY . .

# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy ONLY package files first
COPY package*.json ./

# Install all dependencies first
RUN npm ci

# Put face models in the runtime path during image build.
RUN mkdir -p /app/models/face-api && cp /app/node_modules/@vladmandic/face-api/model/tiny_face_detector_model* /app/models/face-api/ && cp /app/node_modules/@vladmandic/face-api/model/face_landmark_68_tiny_model* /app/models/face-api/ && cp /app/node_modules/@vladmandic/face-api/model/face_recognition_model* /app/models/face-api/

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install only production dependencies in a clean state
ENV NODE_ENV production
RUN rm -rf node_modules && npm ci --only=production && npm cache clean --force

# Production stage
FROM node:22-bookworm-slim AS production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Create writable folders with proper permissions BEFORE switching user
RUN mkdir -p /app/uploads /app/models/face-api && chown -R nestjs:nodejs /app/uploads /app/models

# Copy production dependencies from build stage
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

# Copy face models from build stage
COPY --from=build --chown=nestjs:nodejs /app/models ./models

# Copy package.json for runtime reference
COPY --chown=nestjs:nodejs package*.json ./

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 80

# Start the application
CMD ["node", "dist/main.js"]
