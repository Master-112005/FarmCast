"use strict";

const Joi = require("joi");

const dateField = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({
    "string.pattern.base":
      "Date must be in YYYY-MM-DD format",
  });

const yieldPayloadSchema = Joi.object({
  state: Joi.string().min(2).required(),
  district: Joi.string().min(2).required(),
  crop: Joi.string().min(2).required(),
  soil: Joi.string().min(2).required(),
  sowing_date: dateField.required(),
  field_size: Joi.number().positive().required(),
}).required();

const runPredictionSchema = yieldPayloadSchema;

const recommendationSchema = Joi.object({
  crop_type: Joi.string().min(2).required(),
  soil_type: Joi.string().min(2).required(),
  season: Joi.string().allow("", null),
  soil_ph: Joi.number().min(0).max(14).optional(),
  soil_temp: Joi.number().min(-20).max(80).optional(),
  soil_moisture: Joi.number().min(0).max(100).optional(),
}).required();

const yieldSchema = yieldPayloadSchema;

const predictionMailSchema = Joi.object({
  predictionType: Joi.string()
    .valid("yield", "disease")
    .required(),
  results: Joi.object().unknown(true).required(),
  meta: Joi.object().unknown(true).optional(),
}).required();

module.exports = {
  runPredictionSchema,
  recommendationSchema,
  yieldSchema,
  predictionMailSchema,
};
