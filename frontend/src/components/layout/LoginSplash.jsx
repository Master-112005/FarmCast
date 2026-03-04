/**
 * LoginSplash.jsx
 * ------------------------------------------------------
 * FarmCast - Post-Login Intro Animation
 *
 * Responsibilities:
 * - Show brief branded transition after login
 * - Animate FC-GS -> FarmCast-GrowSmart
 * - Never block the app permanently
 */

"use strict";

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

const SHORT_BRAND = "FC-GS";
const FULL_BRAND = "FarmCast-GrowSmart";
const SPLASH_DURATION_MS = 2000;
const EXPAND_DELAY_MS = 500;

const LoginSplash = ({ visible, onDone, brand = FULL_BRAND }) => {
  const [text, setText] = useState(SHORT_BRAND);

  useEffect(() => {
    if (!visible) return undefined;

    setText(SHORT_BRAND);

    const toFull = setTimeout(() => {
      setText(brand);
    }, EXPAND_DELAY_MS);

    const doneTimer = setTimeout(() => {
      if (typeof onDone === "function") {
        onDone();
      }
    }, SPLASH_DURATION_MS);

    return () => {
      clearTimeout(toFull);
      clearTimeout(doneTimer);
    };
  }, [visible, brand, onDone]);

  if (!visible) return null;

  return (
    <div className="fc-login-splash" role="status" aria-live="polite">
      <div className="fc-login-splash__brand" aria-label={brand}>
        <span className="fc-login-splash__text" aria-hidden="true">
          {text.split("").map((char, index) => (
            <span key={`${char}-${index}`} className="fc-brand-letter">
              {char}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

LoginSplash.propTypes = {
  visible: PropTypes.bool,
  onDone: PropTypes.func,
  brand: PropTypes.string,
};

export default LoginSplash;
