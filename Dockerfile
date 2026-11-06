# ========================================================
# STAGE 1: Build React 19 Frontend with Vite
# ========================================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend-app

# Copy dependency manifests
COPY frontend-app/package*.json ./
RUN npm install

# Copy source and build production bundle
COPY frontend-app/ ./
RUN npm run build

# ========================================================
# STAGE 2: Python Backend & Unified Server (Google Cloud Run)
# ========================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV STATIC_DIR=/app/static

WORKDIR /app

# Install system libraries needed for PDF, Word, and Excel processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Python code
COPY backend/ ./

# Copy compiled React static bundle from Stage 1 into /app/static
COPY --from=frontend-builder /app/frontend-app/dist ./static

# Expose default Cloud Run port
EXPOSE 8080

# Execute Uvicorn server bound to $PORT dynamically provided by Google Cloud Run
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
