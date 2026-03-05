"use strict";

const mqtt = require("mqtt");
const env = require("../../config/env");
const logger = require("../../utils/logger");
const {
  handleDeviceMessage,
} = require("./telemetryHandler");

const BROKER_URL = env.MQTT.BROKER_URL;

let client = null;
let intentionalDisconnect = false;
const cleanedRetainedTopics = new Set();

const clearRetainedTopic = (topic) =>
  new Promise((resolve) => {
    if (!client) {
      resolve(false);
      return;
    }

    client.publish(
      topic,
      "",
      { qos: 1, retain: true },
      (error) => {
        if (error) {
          logger.warn(
            "Failed to clear retained MQTT topic",
            {
              message: error.message,
            }
          );
          resolve(false);
          return;
        }

        resolve(true);
      }
    );
  });



async function connectMQTT() {
  return new Promise((resolve, reject) => {
    try {
      intentionalDisconnect = false;
      let settled = false;
      let connectedOnce = false;

      const settleResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const settleReject = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      client = mqtt.connect(BROKER_URL, {
        reconnectPeriod: 3000, // auto reconnect every 3s
        clean: true,
        username: env.MQTT.CLIENT_USERNAME,
        password: env.MQTT.CLIENT_PASSWORD || undefined,
        clientId: env.MQTT.CLIENT_ID,
      });

      client.on("connect", () => {
        connectedOnce = true;

        logger.info("MQTT connected successfully", {
          broker: BROKER_URL,
        });

        const subscriptions = [
          "devices/+/telemetry",
          "devices/+/heartbeat",
          "devices/+/system/reset",
        ];

        client.subscribe(
          subscriptions,
          { qos: 1 },
          (err) => {
            if (err) {
              logger.error("MQTT subscription failed", {
                error: err.message,
              });
              return reject(err);
            }

            logger.info("Subscribed to device MQTT topics", {
              subscriptions,
            });

            settleResolve();
          }
        );
      });

      client.on(
        "message",
        async (topic, message, packet) => {
        try {
          const payload = message.toString();
          const isRetained =
            packet?.retain === true;

          const result =
            await handleDeviceMessage(topic, payload, {
              isRetained,
            });

          const retainedUnknownDevice =
            isRetained &&
            result?.reason === "unknown_device";

          if (!retainedUnknownDevice) {
            logger.info("MQTT message received", {
              topic,
              retained: isRetained,
            });
          }

          if (
            isRetained &&
            result?.reason === "unknown_device" &&
            !cleanedRetainedTopics.has(topic)
          ) {
            cleanedRetainedTopics.add(topic);
            await clearRetainedTopic(topic);
          }
        } catch (error) {
          logger.error("Telemetry handling failed", {
            message: error.message,
            stack: error.stack,
          });
        }
        }
      );

      client.on("error", (err) => {
        logger.error("MQTT error", {
          message: err.message,
        });

        if (!connectedOnce) {
          settleReject(err);
        }
      });

      client.on("reconnect", () => {
        logger.warn("MQTT reconnecting...");
      });

      client.on("close", () => {
        if (intentionalDisconnect) {
          logger.info("MQTT connection closed");
          return;
        }

        logger.warn("MQTT connection closed");

        if (!connectedOnce) {
          settleReject(
            new Error(
              "MQTT connection closed before ready"
            )
          );
        }
      });

    } catch (error) {
      logger.error("MQTT connection failed", {
        message: error.message,
      });
      reject(error);
    }
  });
}



async function disconnectMQTT() {
  return new Promise((resolve) => {
    if (!client) return resolve();

    intentionalDisconnect = true;

    client.end(false, () => {
      logger.info("MQTT disconnected gracefully");
      client = null;
      resolve();
    });
  });
}



function getClient() {
  return client;
}

module.exports = {
  connectMQTT,
  disconnectMQTT,
  getClient,
};
