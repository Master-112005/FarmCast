import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ENV } from "../../utils/constants";



const DEFAULT_PROFILE_IMAGE =
  "/profile-placeholder.svg";

const isAbsoluteUrl = (value) =>
  /^(https?:|data:|blob:)/i.test(value);

const resolveProfileImage = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  const apiBase = ENV.API_BASE_URL || "";
  const base = apiBase.replace(/\/api\/?$/, "");
  if (!base) return value;

  const normalized = value.startsWith("/")
    ? value
    : `/${value}`;

  return `${base}${normalized}`;
};

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizePhone = (value) =>
  String(value || "").replace(/\D/g, "");

const buildInputId = (label) => {
  const slug = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug ? `fc-${slug}` : undefined;
};



const EditProfileForm = ({
  initialData,
  onSave,
  onCancel,
  onUpload,
  isLoading = false,
  isUploading = false,
  uploadError = "",
}) => {
  const [formData, setFormData] =
    useState(initialData);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] =
    useState(
      resolveProfileImage(initialData?.profileImage)
    );

  const isBusy = isLoading || isUploading;

  /* ---------------- Sync external changes ---------------- */
  useEffect(() => {
    setFormData(initialData);
    setImagePreview(
      resolveProfileImage(initialData?.profileImage)
    );
  }, [initialData]);

  /* ---------------- Cleanup preview ---------------- */
  useEffect(() => {
    return () => {
      if (
        imagePreview &&
        imagePreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  /* ---------------- Change handler ---------------- */
  const update = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      imagePreview &&
      imagePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    if (typeof onUpload === "function") {
      onUpload(file);
    }
  };

  /* ---------------- Submit ---------------- */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isBusy) return;

    if (!formData.name?.trim()) {
      setError("Name is required");
      return;
    }

    if (!isValidEmail(formData.email)) {
      setError("Enter a valid email address");
      return;
    }

    setError(null);

    onSave({
      name: formData.name.trim(),
      phone: normalizePhone(formData.phone),
      email: formData.email.toLowerCase().trim(),
      address: formData.address?.trim() || null,
      fieldSize:
        formData.fieldSize === "" ||
        formData.fieldSize == null
          ? null
          : Number(formData.fieldSize),
    });
  };

  return (
    <form
      className="fc-form"
      aria-label="Edit profile"
      onSubmit={handleSubmit}
    >
      
      {error && (
        <div
          className="fc-alert fc-alert--error"
          role="alert"
        >
          {error}
        </div>
      )}

      
      <div className="fc-form-section">
        <label
          className="fc-label"
          htmlFor="fc-profile-photo"
        >
          Profile Photo
        </label>
        <div className="fc-profile-upload">
          <img
            src={imagePreview}
            alt="Profile preview"
            className="fc-profile-avatar fc-profile-avatar--lg"
          />

          <div className="fc-profile-upload__meta">
            <input
              id="fc-profile-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              disabled={isBusy}
              className="fc-file-input"
            />

            <p className="fc-input__hint">
              JPG, PNG or WebP. Max 5 MB.
            </p>

            {uploadError && (
              <div className="fc-alert fc-alert--error">
                {uploadError}
              </div>
            )}

            {isUploading && (
              <div className="fc-loading" aria-live="polite">
                <span
                  className="fc-loader"
                  aria-hidden
                />
                Uploading image...
              </div>
            )}
          </div>
        </div>
      </div>

      
      <Input
        label="Name"
        value={formData.name || ""}
        disabled={isBusy}
        onChange={(v) => update("name", v)}
      />

      <Input
        label="Phone"
        type="tel"
        value={formData.phone || ""}
        disabled={isBusy}
        onChange={(v) =>
          update("phone", normalizePhone(v))
        }
      />

      <Input
        label="Email"
        type="email"
        value={formData.email || ""}
        disabled={isBusy}
        onChange={(v) => update("email", v)}
      />

      <Textarea
        label="Address"
        value={formData.address || ""}
        disabled={isBusy}
        onChange={(v) => update("address", v)}
      />

      
      <div className="fc-form-row">
        <Input
          label="Field Size (ha)"
          type="number"
          min="0"
          value={formData.fieldSize ?? ""}
          disabled={isBusy}
          onChange={(v) => update("fieldSize", v)}
        />
      </div>

      
      <footer className="fc-card__actions">
        <button
          type="submit"
          className="fc-btn fc-btn--primary"
          disabled={isBusy}
        >
          Save
        </button>

        <button
          type="button"
          className="fc-btn fc-btn--neutral"
          disabled={isBusy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </footer>

      
      {isLoading && (
        <div className="fc-loading" aria-live="polite">
          <span className="fc-loader" aria-hidden />
          Saving profile...
        </div>
      )}
    </form>
  );
};



const Input = ({ label, value, onChange, ...props }) => (
  <div className="fc-form-section">
    <label
      className="fc-label"
      htmlFor={props.id || buildInputId(label)}
    >
      {label}
    </label>
    <input
      {...props}
      id={props.id || buildInputId(label)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fc-input"
    />
  </div>
);

const Textarea = ({ label, value, onChange, ...props }) => (
  <div className="fc-form-section">
    <label
      className="fc-label"
      htmlFor={props.id || buildInputId(label)}
    >
      {label}
    </label>
    <textarea
      {...props}
      id={props.id || buildInputId(label)}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fc-input"
    />
  </div>
);



EditProfileForm.propTypes = {
  initialData: PropTypes.shape({
    name: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    address: PropTypes.string,
    fieldSize: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
    profileImage: PropTypes.string,
  }).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onUpload: PropTypes.func,
  isLoading: PropTypes.bool,
  isUploading: PropTypes.bool,
  uploadError: PropTypes.string,
};

export default EditProfileForm;
