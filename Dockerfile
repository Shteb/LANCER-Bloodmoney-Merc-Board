# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files first for better caching
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY --chown=nodejs:nodejs . .

# Create data directory with proper permissions
RUN cp -r /app/logo_art /app/logo_art_defaults && \
    mkdir -p /app/data /app/logo_art  && \
    chown -R nodejs:nodejs /app/data /app/logo_art /app/logo_art_defaults

# Create entrypoint script - avoid issues with volume shadow mounting
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'if [ -z "$(ls -A /app/logo_art)" ]; then' >> /entrypoint.sh && \
    echo '  echo "Copying default logo_art assets..."' >> /entrypoint.sh && \
    echo '  cp -r /app/logo_art_defaults/* /app/logo_art/' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'exec "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh    

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

ENTRYPOINT ["/entrypoint.sh"]

# Start the application
CMD ["npm", "start"]
