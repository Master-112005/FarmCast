# FarmCast Docker

Use the root-level `docker-compose.yml` for local development. The old
single-service Compose files were removed to avoid multiple competing startup
paths.

## Start Full Stack

From the repository root:

```powershell
docker compose up --build
```

This starts:
- frontend: `http://localhost:3000`
- backend API: `http://localhost:5000`
- ML service: `http://localhost:8000`
- MQTT broker: `localhost:2883`
- MySQL: internal Docker service `mysql:3306`

The broker uses `docker/mosquitto.compose.conf` so it can call the backend
container at `backend:5000` for MQTT auth and ACL validation.

Useful overrides:

```powershell
$env:FRONTEND_HOST_PORT=8080
$env:BACKEND_HOST_PORT=5000
$env:ML_SERVICE_HOST_PORT=8000
$env:MQTT_HOST_PORT=2883
$env:ML_SERVICE_API_KEY="your-dev-key"
docker compose up --build
```

## Files

- `../docker-compose.yml`: full-stack Compose file.
- `mosquitto.compose.conf`: Mosquitto config used by the full stack.
- `aclfile`: baseline MQTT ACL file.
