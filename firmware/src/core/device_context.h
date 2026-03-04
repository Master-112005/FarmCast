#pragma once

#include "../domain/device_state.h"
#include "../domain/firmware_info.h"
#include "../infrastructure/http_client.h"
#include "../infrastructure/json_builder.h"
#include "../runtime/heartbeat_loop.h"
#include "../runtime/telemetry_loop.h"
#include "../services/auth_service.h"
#include "../services/battery_service.h"
#include "../services/device_identity_service.h"
#include "../services/gps_service.h"
#include "../services/mqtt_service.h"
#include "../services/ota_service.h"
#include "../services/soil_sensor_service.h"
#include "../services/wifi_service.h"

class DeviceContext {
 public:
  DeviceContext();

  void begin();
  void loop();

 private:
 static void handleOtaPayload(const String& payload, void* context);
  static void handleWifiUpdatePayload(const String& payload, void* context);
  void onOtaPayload(const String& payload);
  void onWifiUpdatePayload(const String& payload);
  void applyWifiCredentialsUpdate(const String& nextSsid,
                                  const String& nextPassword,
                                  const String& source);
  void handleProvisioning();
  void sendFirmwareInfo();
  void sendProvisioningAck(bool accepted, const String& error = "");
  void handleProvisionPayload(const String& payload);
  void handleFactoryReset();
  void factoryReset(const String& reason);
  void applyFactoryResetIfRequested();
  void enterProvisioningMode(const String& reason);
  void configureMqttTopics();
  void updateLifecycleState(bool wifiConnected,
                            bool authenticated,
                            bool mqttConnected);

  void maybeLogHeap(uint32_t nowMs);
  void maybeEnterDeepSleep(uint32_t nowMs, bool telemetryPublished);

  FirmwareInfo firmwareInfo_;
  DeviceState lifecycleState_;
  DeviceRuntimeState runtimeState_;
  DeviceIdentityService deviceIdentityService_;
  String deviceId_;
  String provisioningRxBuffer_;

  JsonBuilder jsonBuilder_;
  HttpClient httpClient_;
  WifiService wifiService_;
  AuthService authService_;
  MqttService mqttService_;

  SoilSensorService soilSensorService_;
  BatteryService batteryService_;
  GpsService gpsService_;

  OtaService otaService_;
  TelemetryLoop telemetryLoop_;
  HeartbeatLoop heartbeatLoop_;

  uint32_t deepSleepAtMs_;
};
