# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose the application port (this is just metadata, actual binding is in docker-compose.yml)
EXPOSE 3000

# Start the application
CMD ["./scripts/start.sh"]