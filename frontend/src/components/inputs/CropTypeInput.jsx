/**
 * CropTypeSelect.jsx
 * FarmCast - Crop Type Selector (Enterprise / ML-safe)
 *
 * Responsibilities:
 * - Allow user to select a valid crop type
 * - Emit normalized, ML-safe crop value
 *
 * No backend logic
 * No ML logic
 * No routing
 */

import React from "react";
import PropTypes from "prop-types";

/* ======================================================
   ALLOWED CROPS (LOCKED FOR ML SAFETY)
====================================================== */

const CROP_OPTIONS = [
  { label: "Wheat", value: "wheat" },
  { label: "Rice", value: "rice" },
  { label: "Maize", value: "maize" },
  { label: "Chilies", value: "chilies" },
  { label: "Cotton", value: "cotton" },
  { label: "Groundnuts", value: "groundnuts" },
  { label: "Watermelon", value: "watermelon" },
];

/* ======================================================
   COMPONENT
====================================================== */

const CropTypeSelect = ({
  value,
  onChange,
  disabled = false,
  isLoading = false,
  label = "Crop Type",
}) => {
  const isDisabled = disabled || isLoading;

  const handleChange = (e) => {
    const selectedValue = e.target.value;
    onChange(selectedValue);
  };

  return (
    <div className="fc-input-group">
      <label
        htmlFor="crop_type"
        className="fc-label"
      >
        {label}
      </label>

      <select
        id="crop_type"
        value={value}
        onChange={handleChange}
        disabled={isDisabled}
        aria-label="Crop type"
        className="fc-input"
      >
        <option value="" disabled>
          {isLoading ? "Loading crops..." : "Select a crop"}
        </option>

        {CROP_OPTIONS.map((crop) => (
          <option
            key={crop.value}
            value={crop.value}
          >
            {crop.label}
          </option>
        ))}
      </select>

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
          <span>Loading crop options...</span>
        </div>
      )}

    </div>
  );
};

/* ======================================================
   PROPTYPES
====================================================== */

CropTypeSelect.propTypes = {
  value: PropTypes.string.isRequired, // normalized value
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
};

export default CropTypeSelect;
