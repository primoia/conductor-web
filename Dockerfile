# Build stage for both applications
FROM node:20-alpine AS builder

WORKDIR /app

# Build Angular app (editor) first
COPY package*.json ./
RUN npm install
COPY . .
# Exclude the chat directory when copying to avoid conflicts
RUN npm run build --configuration=production

# Build React app (chat) in separate stage
FROM node:18-alpine AS chat-builder

WORKDIR /app
COPY chat/package*.json ./
RUN npm install
COPY chat/ .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy Angular build (root) - serves at /
COPY --from=builder /app/dist/conductor-app/browser /usr/share/nginx/html

# Copy React build (chat subfolder) - serves at /chat
COPY --from=chat-builder /app/dist /usr/share/nginx/html/chat

# Copy custom nginx configuration
COPY nginx-combined.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]