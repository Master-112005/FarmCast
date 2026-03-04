#pragma once

#include <Arduino.h>

#include "../infrastructure/http_client.h"
#include "../infrastructure/json_builder.h"

class AuthService {
 public:
  AuthService(HttpClient& httpClient,
              const JsonBuilder& jsonBuilder,
              const char* apiBaseUrl,
              const char* authPath,
              uint32_t retryInitialMs,
              uint32_t retryMaxMs,
              uint32_t refreshSkewMs,
              uint32_t fallbackTtlSec,
              uint8_t maxConsecutiveAuthFailures);

  void setCredentials(const String& deviceId,
                      const String& deviceSecret);
  void setApiBaseUrl(const String& apiBaseUrl);
  void clearCredentials();
  void clearSession();

  void loop(uint32_t nowMs, bool wifiConnected);

  bool isAuthenticated() const;
  bool hasValidToken(uint32_t nowMs) const;
  const String& token() const;
  const String& userTopicSegment() const;
  bool consumeWifiUpdate(String& ssid, String& password);
  bool consumeFactoryResetSignal();

 private:
  bool shouldRefresh(uint32_t nowMs) const;
  bool shouldAttempt(uint32_t nowMs) const;
  bool authenticate(uint32_t nowMs);
  bool isAuthRequiredResponse(const HttpResponse& response) const;

  uint32_t resolveTtlSec(const String& jwt,
                         uint32_t responseTtlSec) const;
  uint32_t parseJwtTtlSec(const String& jwt) const;
  String parseJwtStringClaim(const String& jwt,
                             const char* claimKey) const;

  HttpClient& httpClient_;
  const JsonBuilder& jsonBuilder_;

  String apiBaseUrl_;
  const char* authPath_;
  String deviceId_;
  String deviceSecret_;

  uint32_t retryInitialMs_;
  uint32_t retryMaxMs_;
  uint32_t refreshSkewMs_;
  uint32_t fallbackTtlSec_;

  uint32_t nextAttemptAtMs_;
  uint32_t retryDelayMs_;

  String token_;
  String userTopicSegment_;
  uint32_t tokenExpiresAtMs_;
  uint8_t maxConsecutiveAuthFailures_;
  uint8_t consecutiveAuthFailures_;
  bool factoryResetSignal_;
  bool wifiUpdatePending_;
  String pendingWifiSsid_;
  String pendingWifiPassword_;
};
