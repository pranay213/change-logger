# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy configuration files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Accept API URL as a build argument and expose it to Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the project
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage to nginx serving directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
