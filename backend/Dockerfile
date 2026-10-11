# FastAPI backend image.
# Build: docker build -t resumeforge-backend ./backend
# Run:   docker run --env-file backend/.env -p 8000:8000 resumeforge-backend

# Start from an official image that already has Python 3.12 on a small Debian.
FROM python:3.12-slim

# Don't write .pyc files, and print logs straight away instead of buffering them.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Every following command runs inside /app in the image.
WORKDIR /app

# Install dependencies before copying the code. Docker caches each step, so
# editing main.py later reuses this layer instead of reinstalling everything.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged user rather than root.
RUN useradd --create-home appuser
USER appuser

# Documents the port the app listens on (publishing it is done with -p / compose).
EXPOSE 8000

# Bind to 0.0.0.0, not 127.0.0.1: inside a container, localhost is only the
# container itself, so traffic forwarded from your machine would never arrive.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
