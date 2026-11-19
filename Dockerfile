# Dockerfile for Fly.io deployment
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies (use npm install since package-lock might not be in context)
RUN npm install --omit=dev

# Copy all source code (including prisma)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Verify static folders exist
RUN ls -la landing/ public/

# Expose port (Fly.io expects 8080)
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]