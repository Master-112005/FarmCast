import React from "react";
import PropTypes from "prop-types";



const SOIL_OPTIONS = [
  { label: "Loamy Soil", value: "loamy_soil" },
  { label: "Clay Soil", value: "clay_soil" },
  { label: "Red Soil", value: "red_soil" },
  { label: "Black Soil", value: "black_soil" },
  { label: "Black Cotton Soil (Regur)", value: "black_cotton_soil" },
  { label: "Alluvial Soil", value: "alluvial_soil" },
  { label: "Coastal Sandy Soil", value: "coastal_sandy_soil" },
  { label: "Forest & Mountain Soil", value: "forest_mountain_soil" },
  { label: "Red & Yellow Soil", value: "red_yellow_soil" },
  { label: "Sandy Soil", value: "sandy_soil" },
  { label: "Laterite Soil", value: "laterite_soil" },
];



const SoilTypeSelect = ({
  value,
  onChange,
  disabled = false,
  isLoading = false,
  label = "Soil Type",
}) => {
  const isDisabled = disabled || isLoading;

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="fc-input-group">
      <label
        htmlFor="soil_type"
        className="fc-label"
      >
        {label}
      </label>

      <select
        id="soil_type"
        value={value}
        onChange={handleChange}
        disabled={isDisabled}
        aria-label="Soil type"
        className="fc-input"
      >
        <option value="" disabled>
          {isLoading ? "Loading soil types..." : "Select soil type"}
        </option>

        {SOIL_OPTIONS.map((soil) => (
          <option
            key={soil.value}
            value={soil.value}
          >
            {soil.label}
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
          <span>Loading soil options...</span>
        </div>
      )}

    </div>
  );
};



SoilTypeSelect.propTypes = {
  value: PropTypes.string.isRequired, // normalized value
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
};

export default SoilTypeSelect;
