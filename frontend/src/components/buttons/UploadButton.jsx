import React, { useRef, useState } from "react";
import PropTypes from "prop-types";



const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
];



const UploadButton = ({
  label = "Upload Image",
  onUpload,
  disabled = false,
  isLoading = false,
}) => {
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  const isDisabled = disabled || isLoading;

  /* ---------------- CLICK ---------------- */

  const handleClick = () => {
    if (isDisabled) return;
    fileInputRef.current?.click();
  };

  /* ---------------- VALIDATION ---------------- */

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPG and PNG images are allowed.";
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      return `File size must be under ${MAX_FILE_SIZE_MB} MB.`;
    }

    return "";
  };

  /* ---------------- CHANGE ---------------- */

  const handleChange = (event) => {
    const file = event.target.files?.[0];

    // Always reset input so same file can be reselected
    event.target.value = "";

    if (!file || isDisabled) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");

    try {
      onUpload(file);
    } catch (err) {
      console.error("❌ UploadButton error:", err);
      setError("Failed to process selected file.");
    }
  };

  

  return (
    <div className="fc-upload">

      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={isLoading}
        className="fc-btn fc-btn--secondary"
      >
        <span
          className="material-icons"
          aria-hidden="true"
        >
          {isLoading ? "hourglass_top" : "upload_file"}
        </span>

        <span>
          {isLoading ? "Uploading…" : label}
        </span>

        {isLoading && (
          <span
            className="fc-loader"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleChange}
        hidden
      />

      {/* Error message */}
      {error && (
        <div
          className="fc-alert fc-alert--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Helper text */}
      <p className="fc-upload__hint">
        JPG or PNG • Max {MAX_FILE_SIZE_MB} MB
      </p>

    </div>
  );
};



UploadButton.propTypes = {
  label: PropTypes.string,
  onUpload: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
};

export default UploadButton;
