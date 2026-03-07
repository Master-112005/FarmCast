# MQTT Broker Hardening (Phase 1)

## Files
- `mosquitto.conf`: Mosquitto + go-auth plugin config with anonymous access disabled.
- `aclfile`: Baseline ACLs (device-by-username + backend collector account).
- `docker-compose.mqtt.yml`: Hardened broker container using `mosquitto-go-auth`.

## Start Broker
From this directory:

```powershell
docker compose -f docker-compose.mqtt.yml up -d
```

Host port `2883` is used by default because `1883` is reserved on some
Windows machines. Override it when needed:

```powershell
$env:MQTT_HOST_PORT=31883
docker compose -f docker-compose.mqtt.yml up -d
```

If you change the host port, keep `MQTT_BROKER_URL` in the backend aligned
with it.

## Restart After Config Changes

```powershell
docker compose -f docker-compose.mqtt.yml restart mqtt-broker
```

## Validate Endpoint Dependency
Broker auth callbacks require backend API:
- `POST /api/v1/mqtt/validate`

If backend runs outside Docker, `host.docker.internal:5000` must be reachable from container.
