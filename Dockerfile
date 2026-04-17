# Use a slim Python 3.11 image to minimize size
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory properly before any commands
WORKDIR /app/backend

# Copy ONLY requirements.txt to cache the dependency layer
COPY backend/requirements.txt ./

# Install dependencies without cache
RUN pip install --no-cache-dir -r requirements.txt

# Copy all remaining files from the backend directory into /app/backend
COPY backend/ ./

# Railway passes $PORT dynamically.
# Using the shell string format ensures $PORT evaluates successfully.
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
