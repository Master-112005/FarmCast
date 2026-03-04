#include "json_builder.h"

#include <ArduinoJson.h>
#include <cmath>

namespace {

bool extractStringField(const JsonVariantConst& root,
                        const char* key,
                        String& out) {
  if (!root[key].isNull()) {
    out = root[key].as<String>();
    return out.length() > 0;
  }
  return false;
}

bool extractToken(const JsonVariantConst& root,
                  String& token) {
  if (extractStringField(root, "token", token)) return true;
  if (extractStringField(root, "jwt", token)) return true;
  if (extractStringField(root, "accessToken", token)) return true;
  if (extractStringField(root, "access_token", token)) return true;

  if (!root["data"].isNull()) {
    return extractToken(root["data"], token);
  }

  return false;
}

bool extractWifiUpdate(const JsonVariantConst& root,
                       WifiUpdatePayload& wifiUpdate) {
  wifiUpdate = WifiUpdatePayload{};

  JsonVariantConst candidate = root["wifiUpdate"];
  if (candidate.isNull() && !root["data"].isNull()) {
    candidate = root["data"]["wifiUpdate"];
  }

  if (candidate.isNull()) {
    return false;
  }

  String ssid;
  String password;
  extractStringField(candidate, "ssid", ssid);
  extractStringField(candidate, "password", password);

  if (ssid.isEmpty() || password.isEmpty()) {
    return false;
  }

  wifiUpdate.ssid = ssid;
  wifiUpdate.password = password;
  wifiUpdate.valid = true;
  return true;
}

uint32_t extractExpirySec(const JsonVariantConst& root) {
  if (!root["expiresIn"].isNull())
    return root["expiresIn"].as<uint32_t>();
  if (!root["expires_in"].isNull())
    return root["expires_in"].as<uint32_t>();
  if (!root["ttl"].isNull())
    return root["ttl"].as<uint32_t>();

  if (!root["data"].isNull())
    return extractExpirySec(root["data"]);

  return 0;
}

double sanitizeDouble(double v) {
  return std::isfinite(v) ? v : 0.0;
}

float sanitizeFloat(float v) {
  return std::isfinite(v) ? v : 0.0f;
}

}  // namespace

//
// ---------------- AUTH ----------------
//

String JsonBuilder::buildAuthRequest(const String& deviceId,
                                     const String& deviceSecret) const {
  JsonDocument doc;

  doc["deviceId"] = deviceId;
  doc["deviceSecret"] = deviceSecret;

  String output;
  serializeJson(doc, output);
  return output;
}

//
// ---------------- TELEMETRY ----------------
//

String JsonBuilder::buildTelemetry(const TelemetryPacket& packet) const {
  if (packet.deviceId.length() == 0) {
    return String();
  }

  JsonDocument doc;

  doc["deviceId"] = packet.deviceId;
  doc["lat"] = sanitizeDouble(packet.latitude);
  doc["lng"] = sanitizeDouble(packet.longitude);
  doc["moisture"] = sanitizeFloat(packet.moisture);
  doc["temperature"] = sanitizeFloat(packet.temperature);
  doc["gpsValid"] = packet.gpsValid;
  doc["soilValid"] = packet.soilValid;
  doc["timestamp"] = packet.timestamp;

  String output;
  serializeJson(doc, output);
  return output;
}

//
// ---------------- STATUS ----------------
//

String JsonBuilder::buildStatus(bool online,
                                const String& firmware,
                                const String& event,
                                uint32_t freeHeap) const {
  JsonDocument doc;

  doc["online"] = online;
  doc["firmware"] = firmware;
  doc["event"] = event;
  doc["freeHeap"] = freeHeap;
  doc["timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  return output;
}

//
// ---------------- AUTH RESPONSE ----------------
//

bool JsonBuilder::parseAuthResponse(const String& body,
                                    String& token,
                                    uint32_t& expiresInSec,
                                    WifiUpdatePayload& wifiUpdate) const {
  JsonDocument doc;

  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    return false;
  }

  token = "";
  expiresInSec = 0;
  wifiUpdate = WifiUpdatePayload{};

  const JsonVariantConst root = doc.as<JsonVariantConst>();

  if (!extractToken(root, token)) {
    return false;
  }

  expiresInSec = extractExpirySec(root);
  extractWifiUpdate(root, wifiUpdate);
  return true;
}

//
// ---------------- OTA PARSE ----------------
//

bool JsonBuilder::parseOtaCommand(const String& body,
                                  OtaCommandPayload& command) const {
  command = OtaCommandPayload{};

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    return false;
  }

  const JsonVariantConst root = doc.as<JsonVariantConst>();

  extractStringField(root, "url", command.url);
  extractStringField(root, "version", command.version);
  extractStringField(root, "checksum", command.checksum);

  if (!root["data"].isNull()) {
    const JsonVariantConst nested = root["data"];

    if (command.url.isEmpty())
      extractStringField(nested, "url", command.url);
    if (command.version.isEmpty())
      extractStringField(nested, "version", command.version);
    if (command.checksum.isEmpty())
      extractStringField(nested, "checksum", command.checksum);
  }

  command.valid =
      command.url.length() > 0 &&
      command.version.length() > 0 &&
      command.checksum.length() > 0;

  return command.valid;
}
