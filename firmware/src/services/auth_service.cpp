#include "auth_service.h"

#include <ArduinoJson.h>
#include <cstring>
#include <mbedtls/base64.h>
#include <time.h>

#include "../utils/logger.h"

namespace {

const char* TAG = "AuthService";
const char* AUTH_REQUIRED_CODE = "AUTH_REQUIRED";
bool isPlaceholderSecret(const char* secret) {
  if (!secret) {
    return true;
  }

  return strstr(secret, "CHANGE_ME") != nullptr;
}

String joinUrl(const String& base, const char* path) {
  String url = base;
  if (!url.endsWith("/") && path && path[0] != '/') {
    url += "/";
  }
  url += path ? String(path) : String();
  return url;
}

String base64UrlToBase64(String input) {
  input.replace('-', '+');
  input.replace('_', '/');

  const uint8_t mod = input.length() % 4;
  if (mod > 0) {
    input += String('=', 4 - mod);
  }

  return input;
}

String decodeBase64(const String& encoded) {
  size_t outputLen = 0;
  String decoded;

  const int rc = mbedtls_base64_decode(nullptr,
                                       0,
                                       &outputLen,
                                       reinterpret_cast<const unsigned char*>(
                                           encoded.c_str()),
                                       encoded.length());
  if (rc != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL || outputLen == 0) {
    return decoded;
  }

  decoded.reserve(outputLen + 1);
  unsigned char* buffer =
      reinterpret_cast<unsigned char*>(malloc(outputLen + 1));
  if (!buffer) {
    return decoded;
  }

  if (mbedtls_base64_decode(buffer,
                            outputLen,
                            &outputLen,
                            reinterpret_cast<const unsigned char*>(
                                encoded.c_str()),
                            encoded.length()) != 0) {
    free(buffer);
    return decoded;
  }

  buffer[outputLen] = '\0';
  decoded = reinterpret_cast<char*>(buffer);
  free(buffer);
  return decoded;
}

}  // namespace

AuthService::AuthService(HttpClient& httpClient,
                         const JsonBuilder& jsonBuilder,
                         const char* apiBaseUrl,
                         const char* authPath,
                         uint32_t retryInitialMs,
                         uint32_t retryMaxMs,
                         uint32_t refreshSkewMs,
                         uint32_t fallbackTtlSec,
                         uint8_t maxConsecutiveAuthFailures)
    : httpClient_(httpClient),
      jsonBuilder_(jsonBuilder),
      apiBaseUrl_(apiBaseUrl ? String(apiBaseUrl) : String()),
      authPath_(authPath),
      deviceId_(),
      deviceSecret_(),
      retryInitialMs_(retryInitialMs),
      retryMaxMs_(retryMaxMs),
      refreshSkewMs_(refreshSkewMs),
      fallbackTtlSec_(fallbackTtlSec),
      nextAttemptAtMs_(0),
      retryDelayMs_(retryInitialMs),
      token_(),
      userTopicSegment_(),
      tokenExpiresAtMs_(0),
      maxConsecutiveAuthFailures_(maxConsecutiveAuthFailures == 0
                                      ? 1
                                      : maxConsecutiveAuthFailures),
      consecutiveAuthFailures_(0),
      factoryResetSignal_(false),
      wifiUpdatePending_(false),
      pendingWifiSsid_(),
      pendingWifiPassword_() {}

void AuthService::setCredentials(const String& deviceId,
                                 const String& deviceSecret) {
  deviceId_ = deviceId;
  deviceSecret_ = deviceSecret;
  consecutiveAuthFailures_ = 0;
  factoryResetSignal_ = false;
}

void AuthService::setApiBaseUrl(const String& apiBaseUrl) {
  String normalized = apiBaseUrl;
  normalized.trim();
  if (normalized.isEmpty()) {
    return;
  }

  apiBaseUrl_ = normalized;
}

void AuthService::clearCredentials() {
  deviceId_ = "";
  deviceSecret_ = "";
  consecutiveAuthFailures_ = 0;
  factoryResetSignal_ = false;
  wifiUpdatePending_ = false;
  pendingWifiSsid_ = "";
  pendingWifiPassword_ = "";
  clearSession();
}

void AuthService::clearSession() {
  token_ = "";
  userTopicSegment_ = "";
  tokenExpiresAtMs_ = 0;
  nextAttemptAtMs_ = 0;
  retryDelayMs_ = retryInitialMs_;
}

bool AuthService::consumeFactoryResetSignal() {
  const bool signaled = factoryResetSignal_;
  factoryResetSignal_ = false;
  return signaled;
}

void AuthService::loop(uint32_t nowMs, bool wifiConnected) {
  if (!wifiConnected) {
    return;
  }

  if (!shouldRefresh(nowMs)) {
    return;
  }

  if (!shouldAttempt(nowMs)) {
    return;
  }

  const bool ok = authenticate(nowMs);
  if (ok) {
    retryDelayMs_ = retryInitialMs_;
    nextAttemptAtMs_ = 0;
    return;
  }

  nextAttemptAtMs_ = nowMs + retryDelayMs_;
  retryDelayMs_ = retryDelayMs_ >= retryMaxMs_ / 2
                      ? retryMaxMs_
                      : retryDelayMs_ * 2;
}

bool AuthService::isAuthenticated() const {
  return token_.length() > 0;
}

bool AuthService::hasValidToken(uint32_t nowMs) const {
  if (token_.isEmpty()) {
    return false;
  }

  const int32_t remainingMs =
      static_cast<int32_t>(tokenExpiresAtMs_ - nowMs);
  return remainingMs > static_cast<int32_t>(refreshSkewMs_);
}

const String& AuthService::token() const { return token_; }

const String& AuthService::userTopicSegment() const {
  return userTopicSegment_;
}

bool AuthService::consumeWifiUpdate(String& ssid, String& password) {
  if (!wifiUpdatePending_ ||
      pendingWifiSsid_.isEmpty() ||
      pendingWifiPassword_.isEmpty()) {
    return false;
  }

  ssid = pendingWifiSsid_;
  password = pendingWifiPassword_;
  wifiUpdatePending_ = false;
  pendingWifiSsid_ = "";
  pendingWifiPassword_ = "";
  return true;
}

bool AuthService::shouldRefresh(uint32_t nowMs) const {
  if (token_.isEmpty()) {
    return true;
  }

  const int32_t remainingMs =
      static_cast<int32_t>(tokenExpiresAtMs_ - nowMs);
  return remainingMs <= static_cast<int32_t>(refreshSkewMs_);
}

bool AuthService::shouldAttempt(uint32_t nowMs) const {
  if (nextAttemptAtMs_ == 0) {
    return true;
  }

  return static_cast<int32_t>(nowMs - nextAttemptAtMs_) >= 0;
}

bool AuthService::authenticate(uint32_t nowMs) {
  if (apiBaseUrl_.length() == 0) {
    logger::error(TAG, "Missing API base URL for authentication");
    return false;
  }

  if (deviceId_.length() == 0) {
    logger::error(TAG, "Missing deviceId for authentication");
    return false;
  }

  if (isPlaceholderSecret(deviceSecret_.c_str()) || deviceSecret_.length() == 0) {
    logger::error(
        TAG,
        "Device secret is missing or invalid in secure storage");
    return false;
  }

  const String url = joinUrl(apiBaseUrl_, authPath_);
  const String body =
      jsonBuilder_.buildAuthRequest(deviceId_, deviceSecret_);

  const HttpResponse response = httpClient_.postJson(url, body);

  if (!response.ok()) {
    logger::warn(
        TAG,
        "Auth request failed. HTTP=" + String(response.statusCode) +
            " body=" + response.body);

    if (isAuthRequiredResponse(response)) {
      consecutiveAuthFailures_++;
      logger::warn(TAG,
                   "Auth 401 detected. code=AUTH_REQUIRED count=" +
                       String(consecutiveAuthFailures_));

      // Verification guide:
      // 1) Provision + authenticate device.
      // 2) Delete device in backend.
      // 3) Observe count=1..3, then factory reset trigger.
      if (consecutiveAuthFailures_ >= maxConsecutiveAuthFailures_) {
        logger::error(TAG,
                      "Permanent auth failure detected. Initiating factory reset.");
        factoryResetSignal_ = true;
      }
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      token_ = "";
      userTopicSegment_ = "";
      tokenExpiresAtMs_ = 0;
    }

    return false;
  }

  // Reset only after successful auth response path.
  consecutiveAuthFailures_ = 0;

  String parsedToken;
  uint32_t expiresInSec = 0;
  WifiUpdatePayload wifiUpdate;
  if (!jsonBuilder_.parseAuthResponse(response.body,
                                      parsedToken,
                                      expiresInSec,
                                      wifiUpdate)) {
    logger::error(TAG, "Auth response parse failed");
    return false;
  }

  const uint32_t ttlSec = resolveTtlSec(parsedToken, expiresInSec);
  token_ = parsedToken;
  userTopicSegment_ = parseJwtStringClaim(parsedToken, "userId");
  tokenExpiresAtMs_ = nowMs + (ttlSec * 1000UL);

  if (wifiUpdate.valid) {
    pendingWifiSsid_ = wifiUpdate.ssid;
    pendingWifiPassword_ = wifiUpdate.password;
    wifiUpdatePending_ = true;
    logger::warn(TAG, "Queued WiFi update from auth response");
  }

  logger::info(TAG,
               "Device authenticated. Token TTL(s): " + String(ttlSec));
  return true;
}

bool AuthService::isAuthRequiredResponse(const HttpResponse& response) const {
  if (response.statusCode != 401 || response.body.isEmpty()) {
    return false;
  }

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, response.body);
  if (err) {
    return false;
  }

  const char* code = doc["code"];
  if (!code && !doc["error"].isNull()) {
    code = doc["error"]["code"];
  }

  if (!code) {
    return false;
  }

  return String(code) == AUTH_REQUIRED_CODE;
}

uint32_t AuthService::resolveTtlSec(const String& jwt,
                                    uint32_t responseTtlSec) const {
  if (responseTtlSec > 0) {
    return responseTtlSec;
  }

  const uint32_t jwtTtl = parseJwtTtlSec(jwt);
  if (jwtTtl > 0) {
    return jwtTtl;
  }

  return fallbackTtlSec_;
}

uint32_t AuthService::parseJwtTtlSec(const String& jwt) const {
  const int firstDot = jwt.indexOf('.');
  if (firstDot < 0) {
    return 0;
  }

  const int secondDot = jwt.indexOf('.', firstDot + 1);
  if (secondDot < 0) {
    return 0;
  }

  const String payloadB64Url = jwt.substring(firstDot + 1, secondDot);
  const String payloadB64 = base64UrlToBase64(payloadB64Url);
  const String payloadJson = decodeBase64(payloadB64);
  if (payloadJson.isEmpty()) {
    return 0;
  }

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, payloadJson);
  if (err) {
    return 0;
  }

  const uint32_t exp = doc["exp"].isNull() ? 0 : doc["exp"].as<uint32_t>();
  const uint32_t iat = doc["iat"].isNull() ? 0 : doc["iat"].as<uint32_t>();

  if (exp > iat && iat > 0) {
    return exp - iat;
  }

  const time_t nowEpoch = time(nullptr);
  if (exp > static_cast<uint32_t>(nowEpoch) && nowEpoch > 100000) {
    return exp - static_cast<uint32_t>(nowEpoch);
  }

  return 0;
}

String AuthService::parseJwtStringClaim(const String& jwt,
                                        const char* claimKey) const {
  if (!claimKey || strlen(claimKey) == 0) {
    return String();
  }

  const int firstDot = jwt.indexOf('.');
  if (firstDot < 0) {
    return String();
  }

  const int secondDot = jwt.indexOf('.', firstDot + 1);
  if (secondDot < 0) {
    return String();
  }

  const String payloadB64Url = jwt.substring(firstDot + 1, secondDot);
  const String payloadB64 = base64UrlToBase64(payloadB64Url);
  const String payloadJson = decodeBase64(payloadB64);
  if (payloadJson.isEmpty()) {
    return String();
  }

  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, payloadJson);
  if (err || doc[claimKey].isNull()) {
    return String();
  }

  return doc[claimKey].as<String>();
}
