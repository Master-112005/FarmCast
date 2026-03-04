/**
 * YieldPrediction.jsx
 * FarmCast - Yield and financial estimation output
 */

import React from "react";
import PropTypes from "prop-types";

const isValidNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value);

const INR_FORMATTER = new Intl.NumberFormat(
  "en-IN",
  {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }
);

const formatCurrency = (value) => {
  if (!isValidNumber(value)) return "-";
  return INR_FORMATTER.format(value).replace(
    /\u00A0/g,
    " "
  );
};

const formatValue = (value, suffix = "") =>
  isValidNumber(value) ? `${value}${suffix}` : "-";

const formatConfidence = (confidence) => {
  if (!isValidNumber(confidence)) return null;
  if (confidence > 1 && confidence <= 100) {
    return Math.round(confidence);
  }
  return Math.round(
    Math.min(Math.max(confidence, 0), 1) * 100
  );
};

const YieldPrediction = ({
  cropType,
  soilType,
  totalYield,
  yieldPerHectare,
  pricePerQuintal,
  totalProfit,
  estimationSource = "system",
  confidence,
  isLoading = false,
}) => {
  const confidencePct = formatConfidence(confidence);

  const profitLabel =
    isValidNumber(totalProfit) && totalProfit < 0
      ? "Estimated Loss"
      : "Estimated Profit";

  return (
    <section
      className="fc-card"
      aria-label="Yield and profit prediction"
    >
      <div className="fc-card__header fc-card__header--spaced">
        <h2 className="fc-card__title">
          Yield and Profit Estimation
        </h2>
        <span className="fc-meta">
          Source: {estimationSource}
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
          <span className="fc-label">Soil Type</span>
          <span className="fc-meta-value">
            {soilType || "-"}
          </span>
        </div>
      </div>

      <div className="fc-metadata">
        <div className="fc-meta-row">
          <span className="fc-label">Total Yield</span>
          <span className="fc-value">
            {formatValue(totalYield, " quintals")}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">
            Yield per Hectare
          </span>
          <span className="fc-value">
            {formatValue(yieldPerHectare, " quintals/ha")}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">
            Price per Quintal
          </span>
          <span className="fc-value">
            {formatCurrency(pricePerQuintal)}
          </span>
        </div>
      </div>

      {confidencePct !== null && (
        <div className="fc-confidence">
          <span className="fc-label">
            Prediction Confidence
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
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="fc-meta">
            {confidencePct}%
          </span>
        </div>
      )}

      <div
        className="fc-financial"
        role="status"
      >
        <span className="fc-financial__label">
          {profitLabel}
        </span>
        <span className="fc-financial__value">
          {isLoading
            ? "Calculating..."
            : formatCurrency(totalProfit)}
        </span>
      </div>

      <p className="fc-disclaimer">
        Estimates may vary due to market fluctuations,
        weather conditions, and model updates. Use as
        guidance only.
      </p>
    </section>
  );
};

YieldPrediction.propTypes = {
  cropType: PropTypes.string,
  soilType: PropTypes.string,
  totalYield: PropTypes.number,
  yieldPerHectare: PropTypes.number,
  pricePerQuintal: PropTypes.number,
  totalProfit: PropTypes.number,
  estimationSource: PropTypes.oneOf([
    "system",
    "ml",
    "manual",
  ]),
  confidence: PropTypes.number,
  isLoading: PropTypes.bool,
};

export default YieldPrediction;
