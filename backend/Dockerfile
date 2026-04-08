FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port (must match the PORT environment variable)
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]
