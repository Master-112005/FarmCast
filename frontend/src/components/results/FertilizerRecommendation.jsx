import React from "react";
import PropTypes from "prop-types";

const SEVERITY_BADGE = {
  low: "fc-badge fc-badge--success",
  medium: "fc-badge fc-badge--warning",
  high: "fc-badge fc-badge--danger",
  unknown: "fc-badge fc-badge--neutral",
};

const FertilizerRecommendation = ({
  cropType,
  season,
  soilType,
  soilPh,
  recommendation,
  severity = "unknown",
  isLoading = false,
}) => {
  const badgeClass =
    SEVERITY_BADGE[severity] ||
    SEVERITY_BADGE.unknown;

  return (
    <section
      className="fc-result-panel fc-result-panel--fertilizer"
      aria-label="Fertilizer recommendation"
    >
      <div className="fc-result-panel__badge-row">
        <span className="fc-label">Priority</span>
        <span
          className={badgeClass}
          aria-label={`Risk severity: ${severity}`}
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
          <span className="fc-label">Soil pH</span>
          <span className="fc-meta-value">
            {typeof soilPh === "number"
              ? soilPh
              : "-"}
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
              Analyzing crop, soil, and season...
            </span>
          </div>
        ) : recommendation ? (
          <p className="fc-recommendation__text">
            {recommendation}
          </p>
        ) : (
          <p className="fc-recommendation__placeholder">
            Run prediction to generate a fertilizer
            recommendation.
          </p>
        )}
      </div>

      <p className="fc-disclaimer">
        Recommendations are indicative. Soil testing
        is strongly advised before final application.
      </p>
    </section>
  );
};

FertilizerRecommendation.propTypes = {
  cropType: PropTypes.string,
  season: PropTypes.string,
  soilType: PropTypes.string,
  soilPh: PropTypes.number,
  recommendation: PropTypes.string,
  severity: PropTypes.oneOf([
    "low",
    "medium",
    "high",
    "unknown",
  ]),
  isLoading: PropTypes.bool,
};

export default FertilizerRecommendation;
