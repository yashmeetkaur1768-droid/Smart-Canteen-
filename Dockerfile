# Base image
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer output
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000

WORKDIR /app

# Install g++ to compile the C++ Queue Engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pinned Python dependencies
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application source code
COPY . .

# Compile native C++ engine for Linux
RUN g++ -std=c++14 -O2 cpp/engine.cpp -o cpp/engine && chmod +x cpp/engine

EXPOSE 5000

# Exactly 1 worker process is mandatory: each worker process spawns an isolated
# C++ engine subprocess with its own in-memory state. 8 threads handle concurrency.
CMD ["sh", "-c", "gunicorn --workers 1 --threads 8 --bind 0.0.0.0:$PORT backend.app:app"]
