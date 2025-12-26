# Multi-stage Dockerfile for Options Scanner Application
# Stage 1: Build React Frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy frontend source and build
COPY frontend/ ./
RUN yarn build

# Stage 2: Python Backend with Built Frontend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/ || exit 1

# Start the application
CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000"]
