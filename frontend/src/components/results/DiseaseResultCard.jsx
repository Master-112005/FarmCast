import React from "react";
import PropTypes from "prop-types";

const SEVERITY_BADGE = {
  low: "fc-badge fc-badge--success",
  medium: "fc-badge fc-badge--warning",
  high: "fc-badge fc-badge--danger",
  unknown: "fc-badge fc-badge--neutral",
};

const normalizeConfidence = (confidence) => {
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed)) return null;

  if (parsed > 1 && parsed <= 100) {
    return Math.round(parsed);
  }

  return Math.round(
    Math.min(Math.max(parsed, 0), 1) * 100
  );
};

const formatTimestamp = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString();
};

const DiseaseResultCard = ({
  cropType,
  diseaseName,
  severity = "unknown",
  confidence,
  detectedAt,
  sourceImage,
  modelVersion = "v1.0",
  isLoading = false,
}) => {
  const confidencePct =
    normalizeConfidence(confidence);

  const badgeClass =
    SEVERITY_BADGE[severity] ||
    SEVERITY_BADGE.unknown;

  return (
    <section
      className="fc-card fc-card--disease"
      aria-label="Disease detection result"
    >
      <div className="fc-card__header">
        <h2 className="fc-card__title">
          Disease Detection
        </h2>

        <span
          className={badgeClass}
          aria-label={`Disease severity: ${severity}`}
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
          <span className="fc-label">
            Detected Disease
          </span>
          <span className="fc-meta-value">
            {diseaseName || "Unknown"}
          </span>
        </div>
      </div>

      {confidencePct !== null && (
        <div className="fc-confidence">
          <span className="fc-label">
            Detection Confidence
          </span>
          <div
            className="fc-confidence__bar"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={confidencePct}
          >
            <div
              className="fc-confidence__fill"
              style={{
                width: `${confidencePct}%`,
              }}
            />
          </div>
          <span className="fc-meta">
            {confidencePct}%
          </span>
        </div>
      )}

      {sourceImage && (
        <div className="fc-image-preview">
          <img
            src={sourceImage}
            alt="Crop sample used for detection"
          />
        </div>
      )}

      <div className="fc-meta-block">
        <span>
          Detected at: {formatTimestamp(detectedAt)}
        </span>
        <span>Model version: {modelVersion}</span>
      </div>

      {isLoading && (
        <div
          className="fc-loading"
          role="status"
          aria-live="polite"
        >
          <span
            className="fc-loader"
            aria-hidden="true"
          />
          <span>Analyzing crop image...</span>
        </div>
      )}

      <p className="fc-disclaimer">
        Disease detection is indicative. Field
        inspection or expert advice is recommended
        before treatment.
      </p>
    </section>
  );
};

DiseaseResultCard.propTypes = {
  cropType: PropTypes.string,
  diseaseName: PropTypes.string,
  severity: PropTypes.oneOf([
    "low",
    "medium",
    "high",
    "unknown",
  ]),
  confidence: PropTypes.number,
  detectedAt: PropTypes.string,
  sourceImage: PropTypes.string,
  modelVersion: PropTypes.string,
  isLoading: PropTypes.bool,
};

export default DiseaseResultCard;
