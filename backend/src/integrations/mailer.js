"use strict";

const nodemailer = require("nodemailer");

const env = require("../config/env");
const logger = require("../utils/logger");
const { ERROR_CODES } = require("../utils/constants");



const mailError = (
  message,
  status = 503,
  code = ERROR_CODES.NOT_IMPLEMENTED
) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

const isPlaceholder = (value) =>
  typeof value === "string" &&
  value.toUpperCase().includes("CHANGE_ME");

const isConfigured = () =>
  Boolean(
    env.MAIL?.SMTP_HOST &&
      env.MAIL?.SMTP_USER &&
      env.MAIL?.SMTP_PASS &&
      env.MAIL?.FROM &&
      !isPlaceholder(env.MAIL.SMTP_HOST) &&
      !isPlaceholder(env.MAIL.SMTP_USER) &&
      !isPlaceholder(env.MAIL.SMTP_PASS)
  );

const isEnabled = () =>
  Boolean(env.MAIL?.ENABLED || isConfigured());

const formatFrom = (email, name) => {
  if (!name) return email;
  return `"${name}" <${email}>`;
};

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.MAIL.SMTP_HOST,
    port: env.MAIL.SMTP_PORT,
    secure: env.MAIL.SMTP_SECURE,
    auth: {
      user: env.MAIL.SMTP_USER,
      pass: env.MAIL.SMTP_PASS,
    },
  });

  return transporter;
};



const sendMail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
}) => {
  if (!isEnabled()) {
    throw mailError(
      "Email delivery is disabled. Set MAIL_ENABLED=true and configure SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM."
    );
  }

  if (!isConfigured()) {
    throw mailError(
      "Email service is not configured. Configure SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM."
    );
  }

  if (!to) {
    throw mailError(
      "Recipient email is required",
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const payload = {
    from: formatFrom(
      env.MAIL.FROM,
      env.MAIL.FROM_NAME
    ),
    to,
    subject,
    text,
  };

  if (html) payload.html = html;
  if (replyTo || env.MAIL.REPLY_TO) {
    payload.replyTo = env.MAIL.REPLY_TO || replyTo;
  }

  const client = getTransporter();

  try {
    const info = await client.sendMail(payload);

    logger.info("MAIL_SENT", {
      to,
      messageId: info?.messageId,
    });

    return info;
  } catch (err) {
    logger.error("MAIL_SEND_FAILED", {
      to,
      message: err?.message,
      code: err?.code,
    });

    if (err?.status) {
      throw err;
    }

    throw mailError(
      "Email delivery failed. Check SMTP configuration and connectivity.",
      502,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

module.exports = Object.freeze({
  sendMail,
  isEnabled,
  isConfigured,
});
