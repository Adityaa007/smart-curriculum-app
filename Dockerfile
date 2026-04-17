# Use a slim Python 3.11 image to minimize size
FROM python:3.11-slim

# Set environment variables
# Prevents Python from writing pyc files to disk
ENV PYTHONDONTWRITEBYTECODE=1
# Prevents Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED=1

# Set the working directory strictly to where the Python code lives
WORKDIR /app/backend

# Copy only the requirements file first to leverage Docker layer caching
COPY backend/requirements.txt .

# Install dependencies (no-cache-dir keeps the final image size smaller)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY backend/ .

# Railway dynamically injects the $PORT environment variable at runtime.
# We use the shell form of CMD (without square brackets) so $PORT is evaluated properly.
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
