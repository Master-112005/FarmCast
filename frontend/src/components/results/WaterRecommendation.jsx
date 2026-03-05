import React from "react";
import PropTypes from "prop-types";

const SEVERITY_BADGE = {
  low: "fc-badge fc-badge--success",
  medium: "fc-badge fc-badge--warning",
  high: "fc-badge fc-badge--danger",
  unknown: "fc-badge fc-badge--neutral",
};

const isValidNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value);

const formatValue = (value, suffix = "") =>
  isValidNumber(value) ? `${value}${suffix}` : "-";

const WaterRecommendation = ({
  cropType,
  season,
  soilType,
  soilTemp,
  soilMoisture,
  recommendation,
  severity = "unknown",
  isLoading = false,
}) => {
  const badgeClass =
    SEVERITY_BADGE[severity] ||
    SEVERITY_BADGE.unknown;

  return (
    <section
      className="fc-result-panel fc-result-panel--water"
      aria-label="Water recommendation"
    >
      <div className="fc-result-panel__badge-row">
        <span className="fc-label">Urgency</span>
        <span
          className={badgeClass}
          aria-label={`Irrigation urgency: ${severity}`}
        >
          {severity}
        </span>
      </div>

      <div className="fc-metadata">
        <div className="fc-meta-row">
          <span className="fc-label">Crop</span>
          <span className="fc-meta-value">
            {cropType || "-"}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">Season</span>
          <span className="fc-meta-value">
            {season || "-"}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">Soil Type</span>
          <span className="fc-meta-value">
            {soilType || "-"}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">Soil Temperature</span>
          <span className="fc-meta-value">
            {formatValue(soilTemp, " C")}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">Soil Moisture</span>
          <span className="fc-meta-value">
            {formatValue(soilMoisture, " %")}
          </span>
        </div>
      </div>

      <div className="fc-recommendation" role="status">
        {isLoading ? (
          <div className="fc-loading">
            <span
              className="fc-loader"
              aria-hidden="true"
            />
            <span>
              Analyzing crop, season, and moisture...
            </span>
          </div>
        ) : recommendation ? (
          <p className="fc-recommendation__text">
            {recommendation}
          </p>
        ) : (
          <p className="fc-recommendation__placeholder">
            Run prediction to generate irrigation
            guidance.
          </p>
        )}
      </div>

      <p className="fc-disclaimer">
        Irrigation needs vary with rainfall,
        soil type, and crop stage. Field
        observation is advised.
      </p>
    </section>
  );
};

WaterRecommendation.propTypes = {
  cropType: PropTypes.string,
  season: PropTypes.string,
  soilType: PropTypes.string,
  soilTemp: PropTypes.number,
  soilMoisture: PropTypes.number,
  recommendation: PropTypes.string,
  severity: PropTypes.oneOf([
    "low",
    "medium",
    "high",
    "unknown",
  ]),
  isLoading: PropTypes.bool,
};

export default WaterRecommendation;
