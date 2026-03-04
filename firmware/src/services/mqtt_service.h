#pragma once

#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

#include "../domain/telemetry_packet.h"
#include "../infrastructure/json_builder.h"

using OtaMessageHandler = void (*)(const String& payload, void* context);
using WifiUpdateMessageHandler = void (*)(const String& payload, void* context);

class MqttService {
 public:
  MqttService(const char* host,
              uint16_t port,
              bool useTls,
              bool tlsInsecure,
              uint16_t keepAliveSeconds,
              uint32_t reconnectInitialMs,
              uint32_t reconnectMaxMs,
              const JsonBuilder& jsonBuilder);

  void setBrokerHost(const String& host);
  void setDeviceId(const String& deviceId);
  const String& deviceId() const;
  void begin();
  void configureTopics(const String& telemetryTopic,
                       const String& heartbeatTopic,
                       const String& otaTopic,
                       const String& wifiUpdateTopic,
                       const String& systemResetTopic);
  void setOtaHandler(OtaMessageHandler handler, void* context);
  void setWifiUpdateHandler(WifiUpdateMessageHandler handler, void* context);

  void loop(uint32_t nowMs,
            bool wifiConnected,
            const String& jwtToken,
            bool tokenValid);

  bool isConnected();
  void disconnect();
  bool consumeAuthRejectedSignal();
  bool publishTelemetry(const TelemetryPacket& packet);
  bool publishHeartbeat(const String& payload, bool retained = false);
  bool publishSystemReset(const String& payload);

 private:
  bool connect(uint32_t nowMs, const String& jwtToken);
  void handleMessage(char* topic, uint8_t* payload, unsigned int length);

  static void onMessage(char* topic,
                        uint8_t* payload,
                        unsigned int length);
  static MqttService* instance_;

  String host_;
  uint16_t port_;
  bool useTls_;
  bool tlsInsecure_;
  uint16_t keepAliveSeconds_;
  uint32_t reconnectInitialMs_;
  uint32_t reconnectMaxMs_;

  String deviceId_;
  const JsonBuilder& jsonBuilder_;

  WiFiClient plainClient_;
  WiFiClientSecure tlsClient_;
  PubSubClient client_;

  String telemetryTopic_;
  String heartbeatTopic_;
  String otaTopic_;
  String wifiUpdateTopic_;
  String systemResetTopic_;

  OtaMessageHandler otaHandler_;
  void* otaHandlerContext_;
  WifiUpdateMessageHandler wifiUpdateHandler_;
  void* wifiUpdateHandlerContext_;

  uint32_t reconnectDelayMs_;
  uint32_t nextReconnectAtMs_;
  bool authRejectedSignal_;
};
