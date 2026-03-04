/**
 * PredictorView.jsx
 * ------------------------------------------------------
 * FarmCast - Dual Prediction Workspace (Yield + Disease)
 *
 * Responsibilities:
 * - Run crop yield predictions
 * - Run crop disease predictions
 * - Provide mail + screenshot actions per predictor
 *
 * No routing logic
 * No auth mutation
 * No backend business logic
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";

/* ===================== INPUTS ===================== */
import CropTypeInput from "../components/inputs/CropTypeInput";
import SoilTypeInput from "../components/inputs/SoilTypeInput";
import DateInputs from "../components/inputs/DateInputs";
import StateInput from "../components/inputs/StateInput";
import DistrictInput from "../components/inputs/DistrictInput";

/* ===================== BUTTONS ===================== */
import UploadButton from "../components/buttons/UploadButton";
import PredictButton from "../components/buttons/PredictButton";
import ActionButtons from "../components/buttons/ActionButtons";

/* ===================== RESULTS ===================== */
import SoilDataCard from "../components/results/SoilDataCard";
import FertilizerRecommendation from "../components/results/FertilizerRecommendation";
import WaterRecommendation from "../components/results/WaterRecommendation";
import YieldPrediction from "../components/results/YieldPrediction";
import ProfitMetrics from "../components/results/ProfitMetrics";
import DiseaseResultCard from "../components/results/DiseaseResultCard";

/* ===================== LAYOUT ===================== */
import Card from "../components/layout/Card";

/* ===================== SERVICES ===================== */
import {
  runPrediction,
  uploadCropImage,
  sendPredictionEmail,
} from "../services/predictorService";
import { useAuth } from "../context/AuthContext";

/* ====================================================
   INITIAL STATE
==================================================== */

const INITIAL_FORM = {
  state: "",
  district: "",
  cropType: "",
  soilType: "",
  sowingDate: "",
  harvestingDate: "",
  sellingDate: "",
  fieldSize: "",
};

const YIELD_ACTIONS = [
  {
    id: "sendMail",
    label: "Email Yield Report",
    icon: "mail",
    variant: "primary",
  },
  {
    id: "screenshot",
    label: "Yield Screenshot",
    icon: "photo_camera",
    variant: "secondary",
  },
];

const DISEASE_ACTIONS = [
  {
    id: "sendMail",
    label: "Email Disease Report",
    icon: "mail",
    variant: "primary",
  },
  {
    id: "screenshot",
    label: "Disease Screenshot",
    icon: "photo_camera",
    variant: "secondary",
  },
];

/* ====================================================
   DISEASE RESULT NORMALIZATION
==================================================== */

const formatLabel = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value) => {
  const normalized = formatLabel(value);
  if (!normalized) return "";

  return normalized
    .split(" ")
    .map(
      (token) =>
        token.charAt(0).toUpperCase() +
        token.slice(1).toLowerCase()
    )
    .join(" ");
};

const normalizeConfidence = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  if (parsed > 1 && parsed <= 100) {
    return Number((parsed / 100).toFixed(4));
  }

  return Number(Math.min(parsed, 1).toFixed(4));
};

const parseTopLabel = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { cropType: "", diseaseName: "" };
  }

  const [cropToken, ...diseaseTokens] =
    raw.split("__");

  if (diseaseTokens.length === 0) {
    return {
      cropType: "",
      diseaseName: toTitleCase(raw),
    };
  }

  return {
    cropType: toTitleCase(cropToken),
    diseaseName: toTitleCase(
      diseaseTokens.join(" ")
    ),
  };
};

const normalizeSeverity = (
  severity,
  diseaseName,
  confidence
) => {
  const normalized = String(severity || "")
    .trim()
    .toLowerCase();

  if (
    ["low", "medium", "high", "unknown"].includes(
      normalized
    )
  ) {
    return normalized;
  }

  if (
    /(healthy|no disease|normal|safe)/i.test(
      diseaseName
    )
  ) {
    return "low";
  }

  if (confidence == null) return "unknown";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
};

const normalizeDiseaseResult = (
  raw,
  fallbackCropType,
  fallbackImage
) => {
  if (!raw) return null;

  const topCandidates = Array.isArray(raw.top3)
    ? raw.top3
    : Array.isArray(raw.top_3)
    ? raw.top_3
    : [];

  const topCandidate = topCandidates[0] || null;
  const parsedTop = parseTopLabel(
    topCandidate?.label || topCandidate?.class
  );

  const confidence = normalizeConfidence(
    raw.confidence ??
      raw.probability ??
      topCandidate?.confidence
  );

  const diseaseName = toTitleCase(
    raw.diseaseName ||
      raw.disease ||
      raw.prediction ||
      parsedTop.diseaseName
  );

  const cropType = toTitleCase(
    raw.cropType ||
      raw.crop_type ||
      parsedTop.cropType ||
      fallbackCropType
  );

  return {
    cropType,
    diseaseName,
    severity: normalizeSeverity(
      raw.severity,
      diseaseName,
      confidence
    ),
    confidence,
    detectedAt:
      raw.detectedAt ||
      raw.detected_at ||
      new Date().toISOString(),
    sourceImage:
      raw.imageUrl ||
      raw.image ||
      fallbackImage ||
      null,
    modelVersion:
      raw.modelVersion ||
      raw.model_version ||
      "v1.0",
    top3: topCandidates,
  };
};

const CROP_PRICE_PER_QUINTAL = Object.freeze({
  rice: 2200,
  wheat: 2275,
  maize: 2090,
  chilies: 6800,
  chillies: 6800,
  cotton: 6500,
  groundnuts: 6200,
  watermelon: 1400,
});

const deriveSeasonLabel = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const month = date.getMonth() + 1;
  if (month >= 6 && month <= 10) return "Kharif";
  if (month >= 11 || month <= 3) return "Rabi";
  return "Zaid";
};

const estimatePricePerQuintal = (crop) => {
  const key = String(crop || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return CROP_PRICE_PER_QUINTAL[key] ?? null;
};

const normalizeYieldResult = (
  raw,
  formInput
) => {
  if (!raw || typeof raw !== "object") return null;

  const payload =
    raw.data && typeof raw.data === "object"
      ? raw.data
      : raw;

  const hasLegacyShape = Boolean(
    payload.soilData ||
      payload.fertilizer ||
      payload.water ||
      payload.yield ||
      payload.profit
  );

  if (hasLegacyShape) {
    return payload;
  }

  const yieldPerHectare = Number(
    payload.yield_per_hectare ??
      payload.yieldPerHectare
  );

  if (!Number.isFinite(yieldPerHectare)) {
    return payload;
  }

  const cropType = toTitleCase(
    formInput?.cropType ||
      payload.crop_type ||
      payload.cropType
  );
  const soilType = toTitleCase(
    formInput?.soilType ||
      payload.soil_type ||
      payload.soilType
  );
  const sowingDate =
    formInput?.sowingDate ||
    payload.sowing_date ||
    payload.sowingDate;
  const season = deriveSeasonLabel(sowingDate);

  const fieldSize = Number(formInput?.fieldSize);
  const hasFieldSize =
    Number.isFinite(fieldSize) && fieldSize > 0;
  const totalYield = hasFieldSize
    ? Number(
        (yieldPerHectare * fieldSize).toFixed(4)
      )
    : null;

  const parsedPricePerQuintal = Number(
    payload.price_per_quintal ??
      payload.pricePerQuintal
  );
  const pricePerQuintal = Number.isFinite(
    parsedPricePerQuintal
  )
    ? parsedPricePerQuintal
    : estimatePricePerQuintal(
        formInput?.cropType ||
          payload.crop_type ||
          payload.cropType
      );

  const totalProfit =
    totalYield != null &&
    Number.isFinite(pricePerQuintal)
      ? Number(
          (totalYield * pricePerQuintal).toFixed(2)
        )
      : null;

  return {
    soilData: {
      soilPh: null,
      soilTemp: null,
      soilMoisture: null,
      sensorQuality: "estimated",
      measuredAt: null,
    },
    fertilizer: {
      cropType,
      season,
      soilType,
      soilPh: null,
      recommendation:
        "Apply balanced NPK with organic compost to support soil health.",
      severity: "unknown",
    },
    water: {
      cropType,
      season,
      soilType,
      soilTemp: null,
      soilMoisture: null,
      recommendation:
        "Maintain moderate irrigation. Monitor soil moisture weekly and adjust schedules.",
      severity: "unknown",
    },
    yield: {
      cropType,
      soilType,
      yieldPerHectare: Number(
        yieldPerHectare.toFixed(4)
      ),
      totalYield,
      pricePerQuintal,
      totalProfit,
      estimationSource: "ml",
      modelVersion:
        payload.model_version ||
        payload.modelVersion ||
        "v2",
    },
    profit: {
      totalYield,
      pricePerQuintal,
      totalProfit,
    },
  };
};

/* ====================================================
   COMPONENT
==================================================== */

const PredictorView = () => {
  /* ---------------- AUTH ---------------- */
  const { user } = useAuth();

  /* ---------------- STATE ---------------- */
  const [activePredictor, setActivePredictor] =
    useState("yield");

  const [yieldForm, setYieldForm] =
    useState(INITIAL_FORM);
  const [yieldResults, setYieldResults] =
    useState(null);
  const [yieldLoading, setYieldLoading] =
    useState(false);
  const [yieldError, setYieldError] =
    useState("");
  const [yieldMailing, setYieldMailing] =
    useState(false);
  const [yieldMailSuccess, setYieldMailSuccess] =
    useState("");
  const [yieldMailWarning, setYieldMailWarning] =
    useState("");
  const [yieldMailError, setYieldMailError] =
    useState("");

  const [diseaseImage, setDiseaseImage] =
    useState(null);
  const [diseaseResults, setDiseaseResults] =
    useState(null);
  const [diseaseLoading, setDiseaseLoading] =
    useState(false);
  const [diseaseError, setDiseaseError] =
    useState("");
  const [diseaseMailing, setDiseaseMailing] =
    useState(false);
  const [
    diseaseMailSuccess,
    setDiseaseMailSuccess,
  ] = useState("");
  const [
    diseaseMailWarning,
    setDiseaseMailWarning,
  ] = useState("");
  const [diseaseMailError, setDiseaseMailError] =
    useState("");

  const [diseasePreview, setDiseasePreview] =
    useState(null);
  const [
    diseaseUploadNoticeToken,
    setDiseaseUploadNoticeToken,
  ] = useState(0);

  /* ---------------- INPUT HANDLERS ---------------- */

  const handleSelectChange = useCallback(
    (field, value) => {
      setYieldError("");
      setYieldForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleDateChange = useCallback(
    (field, value) => {
      setYieldError("");
      setYieldForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleStateChange = useCallback(
    (value) => {
      setYieldError("");
      setYieldForm((prev) => ({
        ...prev,
        state: value,
        district: "",
      }));
    },
    []
  );

  const handleDistrictChange = useCallback(
    (value) => {
      setYieldError("");
      setYieldForm((prev) => ({
        ...prev,
        district: value,
      }));
    },
    []
  );

  const handleDiseaseUpload = useCallback(
    (file) => {
      setDiseaseImage(file);
      setDiseaseError("");
      setDiseaseResults(null);
      setDiseaseMailSuccess("");
      setDiseaseMailWarning("");
      setDiseaseMailError("");
      setDiseaseUploadNoticeToken(Date.now());
    },
    []
  );

  const handleDiseaseUploadCancel = useCallback(
    () => {
      setDiseaseImage(null);
      setDiseaseError("");
      setDiseaseResults(null);
      setDiseaseMailSuccess("");
      setDiseaseMailWarning("");
      setDiseaseMailError("");
      setDiseaseUploadNoticeToken(0);
    },
    []
  );

  /* ---------------- VALIDATION ---------------- */

  const validationError = useMemo(() => {
    if (!yieldForm.state)
      return "State is required.";
    if (!yieldForm.district)
      return "District is required.";
    if (!yieldForm.cropType)
      return "Crop type is required.";
    if (!yieldForm.soilType)
      return "Soil type is required.";
    if (!yieldForm.sowingDate)
      return "Sowing date is required.";
    if (!yieldForm.fieldSize)
      return "Field size is required.";
    if (Number(yieldForm.fieldSize) <= 0)
      return "Field size must be greater than zero.";
    return null;
  }, [yieldForm]);

  /* ---------------- YIELD PREDICTION ---------------- */

  const handleYieldPredict = async () => {
    if (yieldLoading) return;

    if (validationError) {
      setYieldError(validationError);
      return;
    }

    setYieldLoading(true);
    setYieldError("");
    setYieldResults(null);
    setYieldMailSuccess("");
    setYieldMailWarning("");
    setYieldMailError("");

    const payload = {
      state: yieldForm.state,
      district: yieldForm.district,
      crop: yieldForm.cropType,
      soil: yieldForm.soilType,
      sowing_date: yieldForm.sowingDate,
      field_size: Number(yieldForm.fieldSize),
    };

    const response = await runPrediction(
      payload
    );

    if (!response.success) {
      setYieldError(
        response.error ||
          "Yield prediction failed. Please try again."
      );
      setYieldLoading(false);
      return;
    }

    setYieldResults(
      normalizeYieldResult(response.data, yieldForm)
    );
    setYieldLoading(false);
  };

  /* ---------------- DISEASE PREDICTION ---------------- */

  const handleDiseasePredict = async () => {
    if (diseaseLoading) return;
    if (!diseaseImage) {
      setDiseaseError("Upload a crop image first.");
      return;
    }

    setDiseaseLoading(true);
    setDiseaseError("");
    setDiseaseResults(null);
    setDiseaseMailSuccess("");
    setDiseaseMailWarning("");
    setDiseaseMailError("");

    const response = await uploadCropImage(
      diseaseImage
    );

    if (!response.success) {
      setDiseaseError(
        response.error ||
          "Disease prediction failed. Please try again."
      );
      setDiseaseLoading(false);
      return;
    }

    setDiseaseResults(response.data || {});
    setDiseaseLoading(false);
  };

  useEffect(() => {
    if (!diseaseImage) {
      setDiseasePreview(null);
      return;
    }

    const url = URL.createObjectURL(diseaseImage);
    setDiseasePreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [diseaseImage]);

  useEffect(() => {
    if (!user?.fieldSize) return;
    setYieldForm((prev) => {
      if (prev.fieldSize) return prev;
      return {
        ...prev,
        fieldSize: String(user.fieldSize),
      };
    });
  }, [user?.fieldSize]);

  useEffect(() => {
    if (!diseaseUploadNoticeToken) return undefined;

    const timeoutId = window.setTimeout(() => {
      setDiseaseUploadNoticeToken(0);
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [diseaseUploadNoticeToken]);

  const normalizedDiseaseResult = useMemo(
    () =>
      normalizeDiseaseResult(
        diseaseResults,
        yieldForm.cropType,
        diseasePreview
      ),
    [
      diseaseResults,
      yieldForm.cropType,
      diseasePreview,
    ]
  );

  /* ---------------- ACTIONS ---------------- */

  const handleYieldMail = async () => {
    if (!yieldResults || yieldMailing) return;

    setYieldMailing(true);
    setYieldMailSuccess("");
    setYieldMailWarning("");
    setYieldMailError("");

    const response = await sendPredictionEmail({
      predictionType: "yield",
      results: yieldResults,
      meta: {
        input: yieldForm,
        generatedAt: new Date().toISOString(),
      },
    });

    if (!response.success) {
      setYieldMailError(
        response.error ||
          "Unable to send yield report."
      );
      setYieldMailing(false);
      return;
    }

    if (response.data?.delivered === false) {
      setYieldMailWarning(
        response.data?.message ||
          "Email delivery is unavailable right now."
      );
      setYieldMailing(false);
      return;
    }

    setYieldMailSuccess(
      `Yield report sent to ${user?.email || "your email"}.`
    );
    setYieldMailing(false);
  };

  const handleDiseaseMail = async () => {
    if (
      !normalizedDiseaseResult ||
      diseaseMailing
    )
      return;

    setDiseaseMailing(true);
    setDiseaseMailSuccess("");
    setDiseaseMailWarning("");
    setDiseaseMailError("");

    const response = await sendPredictionEmail({
      predictionType: "disease",
      results: normalizedDiseaseResult,
      meta: {
        input: {
          cropType: yieldForm.cropType,
          imageName: diseaseImage?.name || null,
        },
        generatedAt: new Date().toISOString(),
      },
    });

    if (!response.success) {
      setDiseaseMailError(
        response.error ||
          "Unable to send disease report."
      );
      setDiseaseMailing(false);
      return;
    }

    if (response.data?.delivered === false) {
      setDiseaseMailWarning(
        response.data?.message ||
          "Email delivery is unavailable right now."
      );
      setDiseaseMailing(false);
      return;
    }

    setDiseaseMailSuccess(
      `Disease report sent to ${user?.email || "your email"}.`
    );
    setDiseaseMailing(false);
  };

  const handleYieldAction = (actionId) => {
    if (!yieldResults) return;

    switch (actionId) {
      case "sendMail":
        handleYieldMail();
        break;
      case "screenshot":
        window.print();
        break;
      default:
        break;
    }
  };

  const handleDiseaseAction = (actionId) => {
    if (!normalizedDiseaseResult) return;

    switch (actionId) {
      case "sendMail":
        handleDiseaseMail();
        break;
      case "screenshot":
        window.print();
        break;
      default:
        break;
    }
  };

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <div className="predictor-page">
      {Boolean(diseaseUploadNoticeToken) && (
        <div
          className="predictor-toast"
          role="status"
          aria-live="polite"
        >
          Image is uploaded.
        </div>
      )}

      <div className="predictor-grid">
      <div className="predictor-left">
        <div className="predictor-switch">
          <div
            className="fc-view-switch"
            role="tablist"
            aria-label="Predictor mode switch"
          >
            <button
              type="button"
              role="tab"
              aria-selected={
                activePredictor === "yield"
              }
              onClick={() =>
                setActivePredictor("yield")
              }
              className={`fc-view-switch__btn ${
                activePredictor === "yield"
                  ? "is-active"
                  : ""
              }`}
            >
              <span>Yield Predictor</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activePredictor === "disease"
              }
              onClick={() =>
                setActivePredictor("disease")
              }
              className={`fc-view-switch__btn ${
                activePredictor === "disease"
                  ? "is-active"
                  : ""
              }`}
            >
              <span>Disease Predictor</span>
            </button>
          </div>
        </div>

        {activePredictor === "yield" ? (
          <>
            <Card>
              <div className="predictor-yield__head">
                <h2 className="fc-card__title">
                  Yield Prediction
                </h2>
                <PredictButton
                  label="Predict"
                  loadingLabel="Predicting..."
                  onPredict={handleYieldPredict}
                  disabled={yieldLoading}
                  isLoading={yieldLoading}
                  showIcon={false}
                />
              </div>

              <div className="predictor-yield__primary-row">
                <CropTypeInput
                  value={yieldForm.cropType}
                  onChange={(value) =>
                    handleSelectChange("cropType", value)
                  }
                />

                <SoilTypeInput
                  value={yieldForm.soilType}
                  onChange={(value) =>
                    handleSelectChange("soilType", value)
                  }
                />
              </div>

              <div className="predictor-yield__primary-row">
                <StateInput
                  state={yieldForm.state}
                  setState={handleStateChange}
                  setDistrict={handleDistrictChange}
                />

                <DistrictInput
                  state={yieldForm.state}
                  district={yieldForm.district}
                  setDistrict={handleDistrictChange}
                />
              </div>

              <DateInputs
                sowingDate={yieldForm.sowingDate}
                harvestingDate={
                  yieldForm.harvestingDate
                }
                sellingDate={yieldForm.sellingDate}
                onChange={handleDateChange}
              />

              <div className="predictor-yield__numeric-row">
                <div className="fc-input-group">
                  <label
                    className="fc-label"
                    htmlFor="field_size"
                  >
                    Field Size (ha)
                  </label>
                  <input
                    id="field_size"
                    type="number"
                    min="0"
                    step="0.1"
                    className="fc-input"
                    value={yieldForm.fieldSize}
                    onChange={(e) =>
                      handleSelectChange(
                        "fieldSize",
                        e.target.value
                      )
                    }
                    placeholder="e.g., 1.5"
                  />
                </div>
              </div>

              {yieldError && (
                <div className="fc-alert fc-alert--error u-mt-2">
                  {yieldError}
                </div>
              )}
            </Card>

            {yieldResults?.profit && (
              <Card title="Profit Metrics">
                <ProfitMetrics
                  {...yieldResults.profit}
                />
              </Card>
            )}
          </>
        ) : (
          <Card>
            <div className="predictor-disease__head">
              <h2 className="fc-card__title">
                Disease Prediction
              </h2>

              <PredictButton
                label="Predict"
                loadingLabel="Analyzing..."
                onPredict={handleDiseasePredict}
                disabled={
                  diseaseLoading || !diseaseImage
                }
                isLoading={diseaseLoading}
                showIcon={false}
              />
            </div>

            {!diseaseImage && (
              <UploadButton
                label="Upload Crop Image"
                isLoading={diseaseLoading}
                onUpload={handleDiseaseUpload}
              />
            )}

            {diseasePreview && (
              <div className="predictor-disease__preview u-mt-2">
                <img
                  src={diseasePreview}
                  alt="Uploaded crop preview"
                />
                <button
                  type="button"
                  className="predictor-disease__cancel"
                  onClick={handleDiseaseUploadCancel}
                >
                  Cancel
                </button>
              </div>
            )}

            {diseaseError && (
              <div className="fc-alert fc-alert--error u-mt-2">
                {diseaseError}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="predictor-right">
        {activePredictor === "yield" ? (
          yieldResults ? (
            <>
              {yieldMailSuccess && (
                <div className="fc-alert fc-alert--success">
                  {yieldMailSuccess}
                </div>
              )}

              {yieldMailWarning && (
                <div className="fc-alert fc-alert--warning">
                  {yieldMailWarning}
                </div>
              )}

              {yieldMailError && (
                <div className="fc-alert fc-alert--error">
                  {yieldMailError}
                </div>
              )}

              <div className="predictor-results predictor-results--yield">
                {yieldResults.soilData && (
                  <div className="predictor-results__primary-card">
                    <Card title="Soil Status">
                      <div className="predictor-soil-status">
                        <SoilDataCard
                          {...yieldResults.soilData}
                        />
                        <div className="predictor-soil-actions">
                          <ActionButtons
                            actions={YIELD_ACTIONS}
                            onAction={handleYieldAction}
                            isLoading={yieldMailing}
                          />
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {yieldResults.fertilizer && (
                  <div className="predictor-results__primary-card">
                    <Card title="Fertilizer Recommendation">
                      <FertilizerRecommendation
                        {...yieldResults.fertilizer}
                      />
                    </Card>
                  </div>
                )}

                {yieldResults.water && (
                  <div className="predictor-results__primary-card">
                    <Card title="Water Recommendation">
                      <WaterRecommendation
                        {...yieldResults.water}
                      />
                    </Card>
                  </div>
                )}

                {yieldResults.yield && (
                  <div className="predictor-results__primary-card">
                    <Card title="Yield Prediction">
                      <YieldPrediction
                        {...yieldResults.yield}
                      />
                    </Card>
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="fc-empty-state">
              <span className="material-icons" aria-hidden="true">
                insights
              </span>
              <p className="fc-empty">
                Run a yield prediction to see outputs here.
              </p>
            </div>
          )
        ) : normalizedDiseaseResult ? (
          <>
            <ActionButtons
              actions={DISEASE_ACTIONS}
              onAction={handleDiseaseAction}
              isLoading={diseaseMailing}
            />

            {diseaseMailSuccess && (
              <div className="fc-alert fc-alert--success">
                {diseaseMailSuccess}
              </div>
            )}

            {diseaseMailWarning && (
              <div className="fc-alert fc-alert--warning">
                {diseaseMailWarning}
              </div>
            )}

            {diseaseMailError && (
              <div className="fc-alert fc-alert--error">
                {diseaseMailError}
              </div>
            )}

            <div className="predictor-results">
              <DiseaseResultCard
                cropType={
                  normalizedDiseaseResult.cropType
                }
                diseaseName={
                  normalizedDiseaseResult.diseaseName
                }
                severity={
                  normalizedDiseaseResult.severity
                }
                confidence={
                  normalizedDiseaseResult.confidence
                }
                detectedAt={
                  normalizedDiseaseResult.detectedAt
                }
                sourceImage={
                  normalizedDiseaseResult.sourceImage
                }
                modelVersion={
                  normalizedDiseaseResult.modelVersion
                }
              />
            </div>
          </>
        ) : (
          <div className="fc-empty-state">
            <span className="material-icons" aria-hidden="true">
              coronavirus
            </span>
            <p className="fc-empty">
              Upload an image and run disease prediction to see results.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default PredictorView;


