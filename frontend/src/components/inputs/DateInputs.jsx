import React from "react";
import PropTypes from "prop-types";



const DateInputs = ({
  sowingDate,
  harvestingDate,
  sellingDate,
  onChange,
  disabled = false,
  isLoading = false,
}) => {
  const isDisabled = disabled || isLoading;

  /* ---------------- VALIDATION ---------------- */

  const errors = [];

  if (
    sowingDate &&
    harvestingDate &&
    sowingDate > harvestingDate
  ) {
    errors.push(
      "Sowing date must be before harvesting date."
    );
  }

  if (
    harvestingDate &&
    sellingDate &&
    harvestingDate > sellingDate
  ) {
    errors.push(
      "Harvesting date must be before selling date."
    );
  }

  /* ---------------- HANDLERS ---------------- */

  const handleDateChange = (field) => (e) => {
    onChange(field, e.target.value);
  };

  

  return (
    <fieldset
      className="fc-input-group"
      aria-label="Crop lifecycle dates"
      disabled={isDisabled}
    >
      <legend className="fc-label">
        Crop Lifecycle Dates
      </legend>

      {/* SOWING DATE */}
      <div className="fc-input-field">
        <label
          htmlFor="sowing_date"
          className="fc-label"
        >
          Sowing Date
        </label>
        <input
          type="date"
          id="sowing_date"
          value={sowingDate}
          max={harvestingDate || undefined}
          onChange={handleDateChange("sowingDate")}
          aria-label="Sowing date"
          className="fc-input"
        />
      </div>

      {/* HARVESTING DATE */}
      <div className="fc-input-field">
        <label
          htmlFor="harvesting_date"
          className="fc-label"
        >
          Harvesting Date
        </label>
        <input
          type="date"
          id="harvesting_date"
          value={harvestingDate}
          min={sowingDate || undefined}
          max={sellingDate || undefined}
          onChange={handleDateChange("harvestingDate")}
          aria-label="Harvesting date"
          className="fc-input"
        />
      </div>

      {/* SELLING DATE */}
      <div className="fc-input-field">
        <label
          htmlFor="selling_date"
          className="fc-label"
        >
          Selling Date
        </label>
        <input
          type="date"
          id="selling_date"
          value={sellingDate}
          min={harvestingDate || undefined}
          onChange={handleDateChange("sellingDate")}
          aria-label="Selling date"
          className="fc-input"
        />
      </div>

      {/* VALIDATION ERRORS */}
      {errors.length > 0 && (
        <div
          className="fc-alert fc-alert--error"
          role="alert"
        >
          {errors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading && (
        <div
          className="fc-input__loading"
          role="status"
          aria-live="polite"
        >
          <span
            className="fc-loader"
            aria-hidden="true"
          />
          <span>Loading date controls…</span>
        </div>
      )}
    </fieldset>
  );
};



DateInputs.propTypes = {
  sowingDate: PropTypes.string.isRequired,     // YYYY-MM-DD
  harvestingDate: PropTypes.string.isRequired, // YYYY-MM-DD
  sellingDate: PropTypes.string.isRequired,    // YYYY-MM-DD
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
};

export default DateInputs;
