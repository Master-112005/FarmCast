import React from "react";
import PropTypes from "prop-types";
import { STATES } from "../../utils/constants";

const StateInput = ({
  state,
  setState,
  setDistrict,
  disabled = false,
}) => {
  return (
    <div className="fc-input-group">
      <label className="fc-label" htmlFor="yield_state">
        State
      </label>
      <select
        id="yield_state"
        className="fc-input"
        value={state}
        onChange={(e) => {
          setState(e.target.value);
          setDistrict("");
        }}
        disabled={disabled}
        required
      >
        <option value="">Select State</option>
        {STATES.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
    </div>
  );
};

StateInput.propTypes = {
  state: PropTypes.string.isRequired,
  setState: PropTypes.func.isRequired,
  setDistrict: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default StateInput;
