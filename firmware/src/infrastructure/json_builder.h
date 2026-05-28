#pragma once

#include <Arduino.h>

#include "../domain/telemetry_packet.h"





struct OtaCommandPayload {
  String url;
  String version;
  String checksum;
  bool valid = false;
};

struct WifiUpdatePayload {
  String ssid;
  String password;
  bool valid = false;
};










class JsonBuilder {
 public:




  String buildAuthRequest(const String& deviceId,
                          const String& deviceSecret) const;

  bool parseAuthResponse(const String& body,
                         String& token,
                         uint32_t& expiresInSec,
                         WifiUpdatePayload& wifiUpdate) const;





  String buildTelemetry(const TelemetryPacket& packet) const;





  String buildStatus(bool online,
                     const String& firmware,
                     const String& event,
                     uint32_t freeHeap) const;





  bool parseOtaCommand(const String& body,
                       OtaCommandPayload& command) const;
};
