"use strict";

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

const env = require("../../config/env");
const db = require("../../models");
const logger = require("../../utils/logger");
const {
  ERROR_CODES,
  APP,
  PREDICTION,
} = require("../../utils/constants");
const mlClient = require("../../integrations/mlClient");
const mailer = require("../../integrations/mailer");



const CROP_MAP = Object.freeze({
  wheat: "Wheat",
  rice: "Rice",
  maize: "Maize",
  chilies: "Chillies",
  cotton: "Cotton",
  groundnuts: "Groundnuts",
  watermelon: "Watermelon",
});

const SOIL_MAP = Object.freeze({
  loamy_soil: "Loamy Soil",
  clay_soil: "Clay Soil",
  red_soil: "Red Soil",
  black_soil: "Black Soil",
  black_cotton_soil: "Black Cotton Soil (Regur)",
  alluvial_soil: "Alluvial Soil",
  coastal_sandy_soil: "Coastal Sandy Soil",
  forest_mountain_soil: "Forest & Mountain Soil",
  red_yellow_soil: "Red & Yellow Soil",
  sandy_soil: "Sandy Soil",
  laterite_soil: "Laterite Soil",
});

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

const SEASON_LABELS = Object.freeze({
  KHARIF: "Kharif",
  RABI: "Rabi",
  ZAID: "Zaid",
  UNKNOWN: "Unknown",
});



const domainError = (code, message, status = 400) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeCrop = (value) => {
  const key = normalizeKey(value);
  return CROP_MAP[key] || null;
};

const normalizeSoil = (value) => {
  const key = normalizeKey(value);
  return SOIL_MAP[key] || null;
};

const deriveSeasonLabel = (dateInput) => {
  if (!dateInput) return SEASON_LABELS.UNKNOWN;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return SEASON_LABELS.UNKNOWN;
  }

  const month = date.getMonth() + 1;
  if (month >= 6 && month <= 10) return SEASON_LABELS.KHARIF;
  if (month >= 11 || month <= 3) return SEASON_LABELS.RABI;
  return SEASON_LABELS.ZAID;
};

const deriveSeasonYear = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return `${deriveSeasonLabel(date)}${"/"}${date.getFullYear()}`;
};

const buildSeverity = (value, low, high) => {
  if (value == null) return "unknown";
  if (value <= low) return "high";
  if (value >= high) return "high";
  if (value < (low + high) / 2) return "medium";
  return "low";
};

const buildFertilizerRecommendation = ({
  cropType,
  soilType,
  season,
  soilPh,
}) => {
  let recommendation =
    "Apply balanced NPK with organic compost to support soil health.";

  if (soilPh != null && soilPh < 5.8) {
    recommendation =
      "Soil is acidic. Apply lime before sowing and supplement with balanced NPK.";
  } else if (soilPh != null && soilPh > 7.5) {
    recommendation =
      "Soil is alkaline. Incorporate gypsum and organic matter alongside NPK.";
  }

  return {
    cropType,
    season,
    soilType,
    soilPh,
    recommendation,
    severity: buildSeverity(soilPh, 5.8, 7.5),
  };
};

const buildWaterRecommendation = ({
  cropType,
  soilType,
  season,
  soilTemp,
  soilMoisture,
}) => {
  let recommendation =
    "Maintain moderate irrigation. Monitor soil moisture weekly and adjust schedules.";

  if (soilMoisture != null && soilMoisture < 35) {
    recommendation =
      "Soil is dry. Increase irrigation frequency and consider mulching to retain moisture.";
  } else if (soilMoisture != null && soilMoisture > 70) {
    recommendation =
      "Soil is saturated. Reduce irrigation and improve water outflow where possible.";
  }

  return {
    cropType,
    season,
    soilType,
    soilTemp,
    soilMoisture,
    recommendation,
    severity: buildSeverity(soilMoisture, 40, 70),
  };
};

const REQUIRED_YIELD_FIELDS = Object.freeze([
  "state",
  "district",
  "crop",
  "soil",
  "sowing_date",
  "field_size",
]);

const buildYieldMlPayload = (payload = {}) => {
  const missing = REQUIRED_YIELD_FIELDS.filter((key) => {
    const value = payload?.[key];
    return value == null || String(value).trim() === "";
  });

  if (missing.length > 0) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      `Missing required fields: ${missing.join(", ")}`,
      400
    );
  }

  const fieldSize = Number(payload.field_size);
  if (!Number.isFinite(fieldSize) || fieldSize <= 0) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "field_size must be a positive number",
      400
    );
  }

  return {
    state: String(payload.state).trim(),
    district: String(payload.district).trim(),
    crop: String(payload.crop).trim(),
    soil: String(payload.soil).trim(),
    sowing_date: String(payload.sowing_date).trim(),
    field_size: fieldSize,
  };
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDisplayLabel = (value) => {
  const normalized = String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  return normalized
    .split(" ")
    .map(
      (token) =>
        token.charAt(0).toUpperCase() +
        token.slice(1).toLowerCase()
    )
    .join(" ");
};

const estimatePricePerQuintal = (crop) => {
  const key = normalizeKey(crop);
  return CROP_PRICE_PER_QUINTAL[key] ?? null;
};

const buildSoilSnapshot = (record = null) => {
  if (!record) {
    return {
      soilPh: null,
      soilTemp: null,
      soilMoisture: null,
      sensorQuality: "estimated",
      measuredAt: null,
    };
  }

  return {
    soilPh: null,
    soilTemp: toFiniteNumber(record.temperature),
    soilMoisture: toFiniteNumber(record.moisture),
    sensorQuality: "good",
    measuredAt: record.createdAt
      ? new Date(record.createdAt).toISOString()
      : null,
  };
};

const fetchLatestSoilRecord = async (userId) => {
  if (!userId || !db.Device || !db.SoilRecord) {
    return null;
  }

  const devices = await db.Device.findAll({
    where: { userId },
    attributes: ["id"],
    raw: true,
  });

  const deviceIds = Array.isArray(devices)
    ? devices
        .map((item) => item.id)
        .filter(Boolean)
    : [];

  if (deviceIds.length === 0) {
    return null;
  }

  return db.SoilRecord.findOne({
    where: {
      deviceId: {
        [Op.in]: deviceIds,
      },
    },
    order: [["createdAt", "DESC"]],
    raw: true,
  });
};

const translateMlError = (err) => {
  const status = err?.status && err.status >= 400 && err.status < 500 ? 400 : 502;
  const message = err?.message || "ML service unavailable";
  return domainError(ERROR_CODES.ML_SERVICE_ERROR, message, status);
};

const serializeJson = (value) => {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_err) {
    return null;
  }
};

const buildPredictionSummary = (
  predictionType,
  results = {}
) => {
  if (predictionType === PREDICTION.TYPE.DISEASE) {
    const raw =
      results?.diseaseName ||
      results?.disease ||
      results?.prediction ||
      "Unknown";
    return `Disease prediction: ${toTitleCase(raw)}`;
  }

  if (predictionType === PREDICTION.TYPE.YIELD) {
    const yieldData = results?.yield || results;
    const crop = toTitleCase(
      yieldData?.cropType ||
        yieldData?.crop_type ||
        "Unknown crop"
    );
    const totalYield = yieldData?.totalYield;

    if (Number.isFinite(Number(totalYield))) {
      return `Yield prediction for ${crop}: ${formatNumber(
        Number(totalYield),
        2
      )} quintals`;
    }

    return `Yield prediction for ${crop}`;
  }

  if (predictionType === PREDICTION.TYPE.FERTILIZER) {
    return "Fertilizer recommendation generated";
  }

  if (predictionType === PREDICTION.TYPE.WATER) {
    return "Water recommendation generated";
  }

  return "Prediction completed";
};



const runPrediction = async (payload, context = {}) => {
  try {
    const mlPayload = buildYieldMlPayload(payload);
    const mlResult = await mlClient.predictYield(
      mlPayload
    );

    const yieldPerHectare = toFiniteNumber(
      mlResult?.yield_per_hectare ??
        mlResult?.yieldPerHectare
    );

    if (yieldPerHectare == null) {
      throw domainError(
        ERROR_CODES.ML_SERVICE_ERROR,
        "Invalid ML response: yield_per_hectare missing",
        502
      );
    }

    let latestSoilRecord = null;
    try {
      latestSoilRecord = await fetchLatestSoilRecord(
        context?.userId
      );
    } catch (_err) {
      latestSoilRecord = null;
    }

    const soilData = buildSoilSnapshot(
      latestSoilRecord
    );
    const season = deriveSeasonLabel(
      mlPayload.sowing_date
    );

    const cropType =
      normalizeCrop(mlPayload.crop) ||
      toDisplayLabel(mlPayload.crop) ||
      mlPayload.crop;
    const soilType =
      normalizeSoil(mlPayload.soil) ||
      toDisplayLabel(mlPayload.soil) ||
      mlPayload.soil;

    const fertilizer =
      buildFertilizerRecommendation({
        cropType,
        soilType,
        season,
        soilPh: soilData.soilPh,
      });

    const water = buildWaterRecommendation({
      cropType,
      soilType,
      season,
      soilTemp: soilData.soilTemp,
      soilMoisture: soilData.soilMoisture,
    });

    const totalYield = Number(
      (
        yieldPerHectare * mlPayload.field_size
      ).toFixed(4)
    );
    const pricePerQuintal =
      estimatePricePerQuintal(mlPayload.crop);
    const totalProfit =
      pricePerQuintal == null
        ? null
        : Number(
            (
              totalYield * pricePerQuintal
            ).toFixed(2)
          );
    const confidence = toFiniteNumber(
      mlResult?.confidence
    );

    return {
      soilData,
      fertilizer,
      water,
      yield: {
        cropType,
        soilType,
        totalYield,
        yieldPerHectare,
        pricePerQuintal,
        totalProfit,
        estimationSource: "ml",
        confidence,
        modelVersion:
          mlResult?.model_version ||
          mlResult?.modelVersion ||
          "v2",
      },
      profit: {
        totalYield,
        pricePerQuintal,
        totalProfit,
      },
      requestId:
        mlResult?.request_id || null,
    };
  } catch (err) {
    if (err?.status && !err?.code) {
      throw translateMlError(err);
    }

    if (err?.status) {
      throw err;
    }

    throw domainError(
      ERROR_CODES.ML_SERVICE_ERROR,
      err?.message || "Prediction failed",
      502
    );
  }
};

const fertilizerRecommendation = (payload) => {
  const cropType = normalizeCrop(payload.crop_type) || payload.crop_type || null;
  const soilType = normalizeSoil(payload.soil_type) || payload.soil_type || null;
  const season = payload.season || SEASON_LABELS.UNKNOWN;
  const soilPh = Number(payload.soil_ph ?? payload.soilPh);

  return buildFertilizerRecommendation({
    cropType,
    soilType,
    season,
    soilPh: Number.isFinite(soilPh) ? soilPh : null,
  });
};

const waterRecommendation = (payload) => {
  const cropType = normalizeCrop(payload.crop_type) || payload.crop_type || null;
  const soilType = normalizeSoil(payload.soil_type) || payload.soil_type || null;
  const season = payload.season || SEASON_LABELS.UNKNOWN;
  const soilTemp = Number(payload.soil_temp ?? payload.soilTemp);
  const soilMoisture = Number(payload.soil_moisture ?? payload.soilMoisture);

  return buildWaterRecommendation({
    cropType,
    soilType,
    season,
    soilTemp: Number.isFinite(soilTemp) ? soilTemp : null,
    soilMoisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
  });
};

const yieldEstimation = async (payload, context = {}) => {
  return runPrediction(payload, context);
};

const diseasePrediction = async (file) => {
  if (!file?.path) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Image file is required",
      400
    );
  }

  try {
    const buffer = await fs.promises.readFile(file.path);
    const form = new FormData();
    const blob = new Blob([buffer], { type: file.mimetype || "image/jpeg" });
    form.append("file", blob, file.originalname || path.basename(file.path));

    const result = await mlClient.predictDisease(form);

    return {
      cropType: result?.crop_type || null,
      diseaseName: result?.disease,
      confidence: result?.confidence,
      modelVersion: result?.model_version || null,
      top3: Array.isArray(result?.top_3) ? result.top_3 : [],
      requestId: result?.request_id || null,
    };
  } catch (err) {
    throw translateMlError(err);
  }
};

const recordPredictionHistory = async ({
  userId,
  predictionType,
  status = PREDICTION.STATUS.SUCCESS,
  input = null,
  result = null,
  summary = null,
  requestId = null,
}) => {
  try {
    if (!db.PredictionHistory || !userId) {
      return null;
    }

    if (
      !Object.values(PREDICTION.TYPE).includes(
        predictionType
      )
    ) {
      return null;
    }

    const resolvedStatus = Object.values(
      PREDICTION.STATUS
    ).includes(status)
      ? status
      : PREDICTION.STATUS.SUCCESS;

    const resolvedSummary =
      (typeof summary === "string" &&
        summary.trim()) ||
      buildPredictionSummary(
        predictionType,
        result
      );

    await db.PredictionHistory.create({
      userId,
      predictionType,
      status: resolvedStatus,
      summary: resolvedSummary,
      requestId: requestId || result?.requestId || null,
      inputPayload: serializeJson(input),
      resultPayload: serializeJson(result),
    });

    return true;
  } catch (err) {
    logger.warn("Prediction history capture skipped", {
      userId,
      predictionType,
      message: err.message,
    });
    return null;
  }
};



const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNumber = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "N/A";

  try {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(num);
  } catch (err) {
    return num.toFixed(digits);
  }
};

const formatValue = (value, suffix = "") => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (Number.isNaN(value)) return "N/A";

  if (typeof value === "number") {
    return `${formatNumber(value)}${suffix}`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? `${trimmed}${suffix}` : "N/A";
  }

  return `${value}${suffix}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return "N/A";
  return `${(num * 100).toFixed(1)}%`;
};

const toTitleCase = (value) => {
  if (!value) return "N/A";
  const cleaned = String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "N/A";
  return cleaned
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      return (
        lower.charAt(0).toUpperCase() +
        lower.slice(1)
      );
    })
    .join(" ");
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "N/A";
  let readable = "";
  try {
    readable = date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (err) {
    readable = date.toISOString();
  }
  return `${readable} (${date.toISOString()})`;
};

const buildYieldSummaryRows = (
  results = {},
  metaInput = {}
) => {
  const yieldData = results.yield || results;
  const crop =
    yieldData?.cropType ||
    yieldData?.crop_type ||
    yieldData?.crop ||
    metaInput?.crop ||
    metaInput?.cropType;
  const soil =
    yieldData?.soilType ||
    yieldData?.soil_type ||
    yieldData?.soil ||
    metaInput?.soil ||
    metaInput?.soilType;
  const yieldPerHectare =
    yieldData?.yieldPerHectare ??
    yieldData?.yield_per_hectare;
  const modelVersion =
    yieldData?.modelVersion ||
    yieldData?.model_version;

  return [
    { label: "Crop", value: toTitleCase(crop) },
    {
      label: "Soil Type",
      value: toTitleCase(soil),
    },
    {
      label: "Total Yield",
      value: `${formatNumber(
        yieldData?.totalYield
      )} quintals`,
    },
    {
      label: "Yield per Hectare",
      value: `${formatNumber(
        yieldPerHectare
      )} q/ha`,
    },
    {
      label: "Price per Quintal",
      value: `INR ${formatNumber(
        yieldData?.pricePerQuintal
      )}`,
    },
    {
      label: "Total Profit",
      value: `INR ${formatNumber(
        yieldData?.totalProfit
      )}`,
    },
    {
      label: "Confidence",
      value: formatPercent(yieldData?.confidence),
    },
    {
      label: "Model Version",
      value: formatValue(modelVersion),
    },
  ];
};

const buildDiseaseSummaryRows = (
  results = {},
  metaInput = {}
) => {
  const rawDiseaseName =
    results.diseaseName ||
    results.disease ||
    results.prediction ||
    "N/A";
  const diseaseName = toTitleCase(rawDiseaseName);
  const confidence =
    results.confidence ?? results.probability;
  const modelVersion =
    results.modelVersion || "N/A";
  const crop =
    metaInput?.cropType ||
    results.cropType ||
    results.crop_type ||
    "N/A";

  const isUnavailable = /model[_\s-]?unavailable|unavailable/i.test(
    String(rawDiseaseName || "")
  );

  const status = isUnavailable
    ? "Model Unavailable"
    : "Prediction Complete";

  return {
    rows: [
      { label: "Crop", value: toTitleCase(crop) },
      {
        label: "Detected Disease",
        value: diseaseName,
      },
      {
        label: "Severity",
        value: toTitleCase(results.severity || "unknown"),
      },
      {
        label: "Confidence",
        value: isUnavailable
          ? "N/A"
          : formatPercent(confidence),
      },
      {
        label: "Model Version",
        value: modelVersion,
      },
      {
        label: "Status",
        value: status,
      },
    ],
    status,
  };
};

const buildInputRows = (
  predictionType,
  metaInput = {},
  results = {}
) => {
  if (predictionType === "disease") {
    return [
      {
        label: "Crop",
        value: toTitleCase(
          metaInput?.crop || metaInput?.cropType
        ),
      },
      {
        label: "Image Name",
        value: formatValue(metaInput?.imageName),
      },
      {
        label: "Image URL",
        value: formatValue(results?.imageUrl),
      },
    ];
  }

  return [
    {
      label: "Crop",
      value: toTitleCase(
        metaInput?.crop || metaInput?.cropType
      ),
    },
    {
      label: "Soil Type",
      value: toTitleCase(
        metaInput?.soil || metaInput?.soilType
      ),
    },
    {
      label: "Field Size",
      value: `${formatNumber(
        metaInput?.field_size ??
          metaInput?.fieldSize
      )} ha`,
    },
    {
      label: "Sowing Date",
      value: formatValue(
        metaInput?.sowing_date ??
          metaInput?.sowingDate
      ),
    },
  ];
};

const renderRows = (rows = []) =>
  rows
    .filter((row) => row && row.label)
    .map(
      (row) => `<tr>
  <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;width:44%;">${escapeHtml(
    row.label
  )}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(
    row.value
  )}</td>
</tr>`
    )
    .join("");

const renderTable = (rows = []) =>
  `<table role="presentation" style="width:100%;border-collapse:collapse;">${renderRows(
    rows
  )}</table>`;

const buildPredictionEmail = ({
  predictionType,
  results,
  meta,
  user,
}) => {
  const title =
    predictionType === "disease"
      ? "Crop Disease Prediction"
      : "Crop Yield Prediction";

  const metaPayload =
    meta && typeof meta === "object" ? meta : {};

  const metaInput =
    metaPayload?.input &&
    typeof metaPayload.input === "object"
      ? metaPayload.input
      : {};

  const generatedAt =
    metaPayload?.generatedAt ||
    new Date().toISOString();
  const formattedDate = formatDateTime(generatedAt);

  const appName = APP?.NAME || "FarmCast";
  const recipient = user?.email || "N/A";

  const summaryRows =
    predictionType === "disease"
      ? buildDiseaseSummaryRows(results, metaInput)
      : { rows: buildYieldSummaryRows(results, metaInput) };

  const summaryList =
    summaryRows.rows || summaryRows;

  const inputRows = buildInputRows(
    predictionType,
    metaInput,
    results
  );

  const requestId = results?.requestId || "N/A";

  const diseaseNote =
    predictionType === "disease" &&
    summaryRows.status === "Model Unavailable"
      ? "Our disease model is currently unavailable. Please try again later or contact the administrator."
      : "";

  const textLines = [
    `Hello,`,
    "",
    `Here is your ${title} report from ${appName}.`,
    "",
    "Summary:",
    ...summaryList.map(
      (row) => `- ${row.label}: ${row.value}`
    ),
    "",
    "Input Details:",
    ...inputRows.map(
      (row) => `- ${row.label}: ${row.value}`
    ),
    "",
    `Generated At: ${formattedDate}`,
    `Reference ID: ${requestId}`,
  ];

  if (diseaseNote) {
    textLines.push("", "Note:", diseaseNote);
  }

  textLines.push("", `Sent to: ${recipient}`);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 8px 20px rgba(15,23,42,0.08);">
        <div style="font-size:20px;font-weight:700;margin-bottom:6px;">${escapeHtml(
          title
        )}</div>
        <div style="color:#64748b;font-size:13px;margin-bottom:20px;">${escapeHtml(
          appName
        )} · ${escapeHtml(formattedDate)}</div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:18px;">
          <div style="font-size:14px;font-weight:700;color:#14532d;margin-bottom:10px;">Summary</div>
          ${renderTable(summaryList)}
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:18px;">
          <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:10px;">Input Details</div>
          ${renderTable(inputRows)}
        </div>

        ${
          diseaseNote
            ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;margin-bottom:18px;color:#9a3412;font-size:13px;">${escapeHtml(
                diseaseNote
              )}</div>`
            : ""
        }

        <div style="border-top:1px solid #e2e8f0;padding-top:12px;font-size:12px;color:#64748b;">
          <div>Reference ID: ${escapeHtml(requestId)}</div>
          <div>Recipient: ${escapeHtml(recipient)}</div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject: `${title} - ${appName}`,
    text: textLines.join("\n"),
    html,
  };
};

const sendPredictionMail = async (
  payload,
  context = {}
) => {
  const predictionType = payload?.predictionType;
  const results = payload?.results;
  const meta = payload?.meta;
  const user = context.user;

  if (!predictionType || !results) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Prediction email payload is required",
      400
    );
  }

  if (!user?.email) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "User email is required",
      400
    );
  }

  const emailPayload = buildPredictionEmail({
    predictionType,
    results,
    meta,
    user,
  });

  try {
    await mailer.sendMail({
      to: user.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
    });

    return {
      delivered: true,
      to: user.email,
      subject: emailPayload.subject,
      from: env.MAIL?.FROM || env.ADMIN?.EMAIL || null,
    };
  } catch (err) {
    if (err?.status) {
      throw err;
    }

    logger.error("Prediction email failed", {
      message: err.message,
    });

    throw domainError(
      ERROR_CODES.INTERNAL_ERROR,
      "Unable to send prediction email",
      500
    );
  }
};

module.exports = {
  runPrediction,
  fertilizerRecommendation,
  waterRecommendation,
  yieldEstimation,
  diseasePrediction,
  sendPredictionMail,
  recordPredictionHistory,
  buildFertilizerRecommendation,
  buildWaterRecommendation,
  deriveSeasonLabel,
  deriveSeasonYear,
};
