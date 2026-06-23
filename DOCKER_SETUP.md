# Docker Setup & Deployment Guide

This project is now configured for Docker deployment with automatic startup capabilities.

## Docker Configuration Overview

### Files Added:

- **Dockerfile** - Container image definition
- **docker-compose.yml** - Orchestration and auto-start configuration
- **.dockerignore** - Files excluded from Docker build
- **.env.docker** - Docker environment variables

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Docker Compose (included with Docker Desktop)

### Building and Running

#### Option 1: Using Docker Compose (Recommended - Auto-starts)

```bash
docker-compose up -d
```

The `-d` flag runs the container in detached mode (background). The app will:

- Start automatically
- Restart automatically if it crashes
- Run on unique port **8765**

#### Option 2: Manual Docker Commands

```bash
# Build image
docker build -t file-server:latest .

# Run container with auto-restart
docker run -d \
  --name file-server-app \
  --restart always \
  -p 8765:8765 \
  -v $(pwd)/shared_files:/app/shared_files \
  file-server:latest
```

## Port Information

**Unique Port: 8765**

- This port is rarely used by other services
- Configurable via environment variable `PORT` if needed
- Exposed in both Docker and docker-compose configurations

## Accessing the Application

After starting with Docker:

- **Local access**: http://localhost:8765
- **Network access**: http://YOUR_IP:8765 (e.g., http://192.168.1.100:8765)
- **Default password**: newhope4NewLife (change immediately in `.env` or system environment!)

## Management Commands

### View logs

```bash
docker-compose logs -f file-server
```

### Stop the container

```bash
docker-compose down
```

### Restart the container

```bash
docker-compose restart
```

### View running containers

```bash
docker ps
```

### Remove everything (cleanup)

```bash
docker-compose down -v
```

## Automatic Startup Configuration

The Docker setup includes:

1. **Restart Policy**: `always` - Container automatically restarts on system boot or if it crashes
2. **Health Check**: Monitors application health every 30 seconds
3. **Volume Persistence**: `shared_files` directory is mounted as a persistent volume
4. **Resource Limits**: CPU and memory constraints prevent resource exhaustion

## Environment Variables

Available environment variables (defined in `.env.docker` and `.env.example`):

```
FLASK_ENV=production
FLASK_APP=app.py
PYTHONUNBUFFERED=1
PORT=8765 (optional, defaults to 8765)
SHARED_FOLDER=/mnt/HDD/
ACCESS_PASSWORD=your-secure-password
SECRET_KEY=your-session-encryption-key
```

## Production Considerations

For production deployment:

1. **Configure Environment:** Create a `.env` file by cloning `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. **Change Default Password:** Edit `.env` to specify a secure password for `ACCESS_PASSWORD`:
   ```ini
   ACCESS_PASSWORD=your-extremely-secure-password
   ```

3. **Configure Secret Key:** Edit `.env` to specify a random string for `SECRET_KEY` (or leave it blank to generate a random key dynamically on each server boot):
   ```ini
   SECRET_KEY=some-cryptographically-secure-random-string
   ```

4. **Deploy on Server** - Use Docker on a production server or cloud platform (AWS, Azure, DigitalOcean, etc.)

## Troubleshooting

### Container won't start

```bash
docker-compose logs file-server
```

### Port already in use

Change port in `docker-compose.yml`:

```yaml
ports:
  - "9876:8765" # Map to a different host port
```

### Permission denied errors

Ensure proper permissions on shared_files directory:

```bash
chmod 755 shared_files
```

### Container keeps restarting

Check logs with:

```bash
docker-compose logs --tail 50 file-server
```

## Summary

Your File Server is now fully containerized and configured to:
✅ Start automatically on Docker daemon startup  
✅ Restart automatically on failure  
✅ Run on unique port 8765  
✅ Persist files in shared_files volume  
✅ Include health monitoring  
✅ Support network access from other devices
