# Stage 1: Install dependencies
FROM node:lts AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Stage 2: Build the application
FROM node:lts AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for production build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 3: Production runtime
FROM node:lts AS runner
WORKDIR /app

# Set production mode
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN groupadd --gid 1001 nodejs || true
RUN useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs || true

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
USER nextjs

# Expose the port
EXPOSE 80

# Environment variables
ENV PORT=80
ENV HOSTNAME=0.0.0.0

# Start the application
CMD ["node", "server.js"]
