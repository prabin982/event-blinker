# Use Node.js 18 LTS as base image
FROM node:18-slim

# Install system dependencies for PostGIS (if needed, though pg-promise handles it)
# and any native build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start the application - migration happens before starting the server
CMD ["npm", "start"]
