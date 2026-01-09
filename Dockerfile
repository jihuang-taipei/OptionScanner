# Multi-stage Dockerfile for Options Scanner Application
# Stage 1: Build React Frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

# Copy package files first
COPY frontend/package.json ./

# Copy yarn.lock if it exists (bracket trick makes it optional)
COPY frontend/yarn.loc[k] ./
#
# Install dependencies
RUN yarn install

# Copy frontend source and build
COPY frontend/ ./

# Set production backend URL (will be same origin in production)
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# Stage 2: Python Backend with Built Frontend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code (modular structure)
COPY backend/server.py ./backend/
COPY backend/models/ ./backend/models/
COPY backend/routes/ ./backend/routes/
COPY backend/services/ ./backend/services/

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV PYTHONPATH=/app/backend

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/ || exit 1

# Start the application
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
