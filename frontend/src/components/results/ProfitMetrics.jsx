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

const formatCurrency = (value) =>
  isValidNumber(value)
    ? INR_FORMATTER.format(value).replace(
        /\u00A0/g,
        " "
      )
    : "-";

const formatYield = (value) =>
  isValidNumber(value) ? `${value} quintals` : "-";

const formatFormula = (
  totalYield,
  pricePerQuintal
) => {
  if (
    !isValidNumber(totalYield) ||
    !isValidNumber(pricePerQuintal)
  ) {
    return "-";
  }

  return `${totalYield} x ${formatCurrency(
    pricePerQuintal
  )}`;
};

const ProfitMetrics = ({
  totalYield,
  pricePerQuintal,
  totalProfit,
  isLoading = false,
}) => {
  const profitLabel =
    isValidNumber(totalProfit) && totalProfit < 0
      ? "Estimated Loss"
      : "Estimated Profit";

  return (
    <section
      className="fc-card"
      aria-label="Profit metrics"
    >
      <div className="fc-card__header">
        <h2 className="fc-card__title">
          Profit Summary
        </h2>
      </div>

      <div className="fc-metadata">
        <div className="fc-meta-row">
          <span className="fc-label">Total Yield</span>
          <span className="fc-meta-value">
            {formatYield(totalYield)}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">
            Price per Quintal
          </span>
          <span className="fc-meta-value">
            {formatCurrency(pricePerQuintal)}
          </span>
        </div>
      </div>

      <div className="fc-formula">
        <span className="fc-label">Formula</span>
        <span className="fc-formula__value">
          {formatFormula(
            totalYield,
            pricePerQuintal
          )}
        </span>
      </div>

      <div
        className="fc-financial"
        role="status"
        aria-live="polite"
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
        Profit estimates depend on market prices,
        yield accuracy, and post-harvest factors.
        Use as guidance only.
      </p>
    </section>
  );
};

ProfitMetrics.propTypes = {
  totalYield: PropTypes.number,
  pricePerQuintal: PropTypes.number,
  totalProfit: PropTypes.number,
  isLoading: PropTypes.bool,
};

export default ProfitMetrics;
