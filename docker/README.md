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

## Restart After Config Changes

```powershell
docker compose -f docker-compose.mqtt.yml restart mqtt-broker
```

## Validate Endpoint Dependency
Broker auth callbacks require backend API:
- `POST /api/v1/mqtt/validate`

If backend runs outside Docker, `host.docker.internal:5000` must be reachable from container.
