# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Copy ONLY package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code AFTER installing dependencies
COPY . .

# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy ONLY package files first
COPY package*.json ./

# Install all dependencies first
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install only production dependencies in a clean state
ENV NODE_ENV production
RUN rm -rf node_modules && npm ci --only=production && npm cache clean --force

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Create uploads directory with proper permissions BEFORE switching user
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

# Copy production dependencies from build stage
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

# Copy package.json for runtime reference
COPY --chown=nestjs:nodejs package*.json ./

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 80

# Start the application
CMD ["node", "dist/main.js"]
