#include "http_client.h"

#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

HttpClient::HttpClient(uint16_t timeoutMs, bool allowInsecureTls)
    : timeoutMs_(timeoutMs), allowInsecureTls_(allowInsecureTls) {}

HttpResponse HttpClient::postJson(const String& url,
                                  const String& payload,
                                  const String& bearerToken) {
  HttpResponse response;

  HTTPClient http;
  const bool useTls = url.startsWith("https://");
  bool beginOk = false;

  WiFiClient plainClient;
  WiFiClientSecure tlsClient;

  if (useTls) {
    if (allowInsecureTls_) {
      tlsClient.setInsecure();
    }
    beginOk = http.begin(tlsClient, url);
  } else {
    beginOk = http.begin(plainClient, url);
  }

  if (!beginOk) {
    response.statusCode = -1;
    response.body = "HTTP begin failed";
    return response;
  }

  http.setTimeout(timeoutMs_);
  http.addHeader("Content-Type", "application/json");

  if (bearerToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + bearerToken);
  }

  response.statusCode = http.POST(payload);

  if (response.statusCode > 0) {
    response.body = http.getString();
  } else {
    response.body = http.errorToString(response.statusCode);
  }

  http.end();
  return response;
}
