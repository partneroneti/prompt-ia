FROM node:20-alpine AS base
WORKDIR /app

# Install only production dependencies for the API
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY server/ ./

EXPOSE 3001
CMD ["node", "index.js"]
