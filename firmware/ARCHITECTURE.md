# FarmCast Firmware Architecture (Industrial Runtime)

## Runtime Flow
1. Boot + watchdog init
2. WiFi connectivity loop
3. Device auth (`POST /api/v1/devices/auth`)
4. MQTT connect using JWT
5. Telemetry + heartbeat loops
6. OTA command handling
7. Optional deep sleep after successful telemetry cycle

## Module Map
- `src/core/system_boot.*`: serial, boot reason, watchdog, deep sleep entry.
- `src/core/device_context.*`: dependency wiring, main orchestration state machine.
- `src/services/wifi_service.*`: non-blocking WiFi reconnect.
- `src/services/auth_service.*`: JWT acquisition/refresh with retry backoff.
- `src/services/mqtt_service.*`: tokenized MQTT session, reconnect, OTA subscription.
- `src/runtime/telemetry_loop.*`: sensor read -> schema-safe telemetry publish.
- `src/runtime/heartbeat_loop.*`: status heartbeat publish.
- `src/services/ota_service.*`: OTA queue, version gate, HTTPS download, checksum verify, reboot scheduling.
- `src/services/soil_sensor_service.*`: moisture + temperature acquisition.
- `src/services/gps_service.*`: GPS parse and fallback coordinates.
- `src/services/battery_service.*`: battery voltage acquisition.
- `src/infrastructure/http_client.*`: HTTP transport wrapper.
- `src/infrastructure/json_builder.*`: centralized request/payload/command JSON contract.
- `src/domain/*`: firmware/telemetry/state data models.
- `src/utils/logger.*`: leveled structured logs.
- `src/utils/time_utils.*`: rollover-safe timing helpers.

## Configuration Boundaries
- `include/config.h`: all runtime settings (network, intervals, pins, OTA, sleep).
- `include/device_identity.h`: per-device identity + secret.
- `include/topics.h`: MQTT topic builders (no topic literals in service logic).
- `include/build_info.h`: firmware version/build metadata.

## Telemetry Schema
Published JSON fields are fixed:
- `moisture` (float)
- `temperature` (float)
- `latitude` (float)
- `longitude` (float)
- `battery` (float)
- `firmware` (string)
- `timestamp` (number)

## Stage Verification Checklist
- Stage 1: boot logs show version + reset reason; WiFi reconnect is non-blocking.
- Stage 2: backend receives auth payload (`deviceId`, `deviceSecret`); JWT refreshes before expiry.
- Stage 3: broker reconnect recovers automatically; OTA topic subscription remains active.
- Stage 4: telemetry payload keys match schema exactly; backend ingestion and alerts continue.
- Stage 5: OTA only applies newer version with valid checksum over HTTPS; device reboots safely.
- Stage 6: deep sleep only after telemetry publish and never during OTA; wake resumes full reconnect flow.
