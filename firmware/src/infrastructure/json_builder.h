#pragma once

#include <Arduino.h>

#include "../domain/telemetry_packet.h"

//
// ---------------- OTA PAYLOAD ----------------
//

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

//
// ---------------- JSON BUILDER ----------------
//
// Responsibility:
//  - Serialize domain objects into JSON
//  - Parse backend responses
//  - NO business validation logic
//

class JsonBuilder {
 public:
  //
  // -------- AUTH --------
  //

  String buildAuthRequest(const String& deviceId,
                          const String& deviceSecret) const;

  bool parseAuthResponse(const String& body,
                         String& token,
                         uint32_t& expiresInSec,
                         WifiUpdatePayload& wifiUpdate) const;

  //
  // -------- TELEMETRY --------
  //

  String buildTelemetry(const TelemetryPacket& packet) const;

  //
  // -------- STATUS --------
  //

  String buildStatus(bool online,
                     const String& firmware,
                     const String& event,
                     uint32_t freeHeap) const;

  //
  // -------- OTA --------
  //

  bool parseOtaCommand(const String& body,
                       OtaCommandPayload& command) const;
};
