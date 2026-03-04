import React from "react";
import PropTypes from "prop-types";
import { DISTRICTS } from "../../utils/constants";

const DistrictInput = ({
  state,
  district,
  setDistrict,
  disabled = false,
}) => {
  const options = state ? DISTRICTS[state] || [] : [];

  return (
    <div className="fc-input-group">
      <label className="fc-label" htmlFor="yield_district">
        District
      </label>
      <select
        id="yield_district"
        className="fc-input"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        disabled={disabled || !state}
        required
      >
        <option value="">Select District</option>
        {options.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
    </div>
  );
};

DistrictInput.propTypes = {
  state: PropTypes.string.isRequired,
  district: PropTypes.string.isRequired,
  setDistrict: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default DistrictInput;
