/**
 * SoilDataCard.jsx
 * FarmCast - Soil Sensor Readings
 */

import React from "react";
import PropTypes from "prop-types";

const isValidNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value);

const formatValue = (value, suffix = "") =>
  isValidNumber(value) ? `${value}${suffix}` : "-";

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString();
};

const VALUE_STATUS = {
  good: "fc-status fc-status--active",
  warning: "fc-status fc-status--warning",
  critical: "fc-status fc-status--danger",
  neutral: "fc-status fc-status--neutral",
};

const QUALITY_BADGE = {
  good: "fc-badge fc-badge--success",
  noisy: "fc-badge fc-badge--warning",
  estimated: "fc-badge fc-badge--info",
  faulty: "fc-badge fc-badge--error",
  unknown: "fc-badge fc-badge--neutral",
};

const evaluatePh = (ph) => {
  if (!isValidNumber(ph)) return VALUE_STATUS.neutral;
  if (ph < 5.5 || ph > 7.5) return VALUE_STATUS.critical;
  return VALUE_STATUS.good;
};

const evaluateTemp = (temp) => {
  if (!isValidNumber(temp)) return VALUE_STATUS.neutral;
  if (temp < 15 || temp > 35) return VALUE_STATUS.warning;
  return VALUE_STATUS.good;
};

const evaluateMoisture = (moisture) => {
  if (!isValidNumber(moisture)) return VALUE_STATUS.neutral;
  if (moisture < 30 || moisture > 70) return VALUE_STATUS.warning;
  return VALUE_STATUS.good;
};

const SoilDataCard = ({
  soilPh,
  soilTemp,
  soilMoisture,
  sensorQuality = "unknown",
  measuredAt,
}) => {
  return (
    <section
      className="fc-result-panel fc-result-panel--soil"
      aria-label="Soil sensor data"
    >
      <div className="fc-result-panel__badge-row">
        <span className="fc-label">Sensor Quality</span>
        <span
          className={
            QUALITY_BADGE[sensorQuality] ||
            QUALITY_BADGE.unknown
          }
          aria-label={`Sensor quality: ${sensorQuality}`}
        >
          {sensorQuality}
        </span>
      </div>

      <div className="fc-data-row">
        <span className="fc-label">Soil pH</span>
        <span className={evaluatePh(soilPh)}>
          {formatValue(soilPh)}
        </span>
      </div>

      <div className="fc-data-row">
        <span className="fc-label">
          Soil Temperature
        </span>
        <span className={evaluateTemp(soilTemp)}>
          {formatValue(soilTemp, " C")}
        </span>
      </div>

      <div className="fc-data-row">
        <span className="fc-label">
          Soil Moisture
        </span>
        <span
          className={evaluateMoisture(soilMoisture)}
        >
          {formatValue(soilMoisture, " %")}
        </span>
      </div>

      <p className="fc-meta">
        Last measured:{" "}
        {formatTimestamp(measuredAt)}
      </p>
    </section>
  );
};

SoilDataCard.propTypes = {
  soilPh: PropTypes.number,
  soilTemp: PropTypes.number,
  soilMoisture: PropTypes.number,
  sensorQuality: PropTypes.oneOf([
    "good",
    "noisy",
    "estimated",
    "faulty",
    "unknown",
  ]),
  measuredAt: PropTypes.string,
};

export default SoilDataCard;
