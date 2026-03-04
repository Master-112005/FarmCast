/**
 * adminService.js
 * ------------------------------------------------------
 * Admin API service
 */

"use strict";

import api from "./api";
import { ENDPOINTS } from "../utils/constants";

const ok = (data, status = 200) => ({
  success: true,
  data,
  status,
});

const fail = (error) => ({
  success: false,
  error: error?.message || "Admin request failed",
  status: error?.status,
  code: error?.code,
});

const execute = async (requestFn) => {
  try {
    const response = await requestFn();
    return ok(response.data, response.status);
  } catch (error) {
    return fail(error);
  }
};

export const getAdminUsers = async () => {
  const endpoint = ENDPOINTS?.ADMIN_USERS;

  if (!endpoint) {
    return fail({
      message: "Admin users endpoint not configured",
    });
  }

  return execute(() => api.get(endpoint));
};

export const getAdminOverview = async () => {
  const endpoint = ENDPOINTS?.ADMIN_OVERVIEW;

  if (!endpoint) {
    return fail({
      message: "Admin overview endpoint not configured",
    });
  }

  return execute(() =>
    api.get(endpoint, {
      __suppressConsoleError: true,
    })
  );
};

export const deleteAdminUser = async (
  userId,
  message
) => {
  const endpoint = ENDPOINTS?.ADMIN_USERS;

  if (!endpoint) {
    return fail({
      message: "Admin users endpoint not configured",
    });
  }

  if (!userId) {
    return fail({
      message: "User ID is required",
    });
  }

  const deleteMessage = String(
    message || ""
  ).trim();

  if (!deleteMessage) {
    return fail({
      message: "Deletion message is required",
    });
  }

  return execute(() =>
    api.delete(`${endpoint}/${userId}`, {
      data: {
        message: deleteMessage,
      },
    })
  );
};

export const getAdminUserPredictionHistory = async (
  userId,
  limit = 12
) => {
  const endpoint = ENDPOINTS?.ADMIN_USERS;

  if (!endpoint) {
    return fail({
      message:
        "Admin prediction history endpoint not configured",
    });
  }

  if (!userId) {
    return fail({
      message: "User ID is required",
    });
  }

  return execute(() =>
    api.get(`${endpoint}/${userId}/predictions`, {
      params: { limit },
    })
  );
};
