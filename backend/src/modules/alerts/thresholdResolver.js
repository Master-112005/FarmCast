"use strict";

const { ALERT } = require("../../utils/constants");

const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const read = (obj, camel, snake) =>
  obj?.[camel] ?? obj?.[snake];

const pickFirstFinite = (...values) => {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const resolveMoistureMinThreshold = (device) =>
  pickFirstFinite(
    read(
      device,
      "moistureMinThreshold",
      "moisture_min_threshold"
    ),
    read(
      device?.crop,
      "moistureMinThreshold",
      "moisture_min_threshold"
    ),
    ALERT.DEFAULTS.MOISTURE_MIN_THRESHOLD
  );

const resolveMoistureMaxThreshold = (device) =>
  pickFirstFinite(
    read(
      device,
      "moistureMaxThreshold",
      "moisture_max_threshold"
    ),
    read(
      device?.crop,
      "moistureMaxThreshold",
      "moisture_max_threshold"
    ),
    ALERT.DEFAULTS.MOISTURE_MAX_THRESHOLD
  );

module.exports = Object.freeze({
  resolveMoistureMinThreshold,
  resolveMoistureMaxThreshold,
});
