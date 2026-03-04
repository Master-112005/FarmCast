#pragma once

#include <Arduino.h>

struct HttpResponse {
  int statusCode = -1;
  String body;

  bool ok() const { return statusCode >= 200 && statusCode < 300; }
};

class HttpClient {
 public:
  HttpClient(uint16_t timeoutMs, bool allowInsecureTls);

  HttpResponse postJson(const String& url,
                        const String& payload,
                        const String& bearerToken = "");

 private:
  uint16_t timeoutMs_;
  bool allowInsecureTls_;
};
