"use strict";

import api, {
  setAuthToken,
  clearAuthToken,
} from "./api";

import {
  ENDPOINTS,
  LIMITS,
  STORAGE_KEYS,
} from "../utils/constants";



const TOKEN_KEY =
  STORAGE_KEYS?.TOKEN ||
  "farmcast.auth.token";
const REFRESH_TOKEN_KEY =
  STORAGE_KEYS?.REFRESH_TOKEN ||
  "farmcast.auth.refreshToken";

const USER_KEY =
  STORAGE_KEYS?.USER ||
  "farmcast.auth.user";

const ALLOWED_IMAGE_TYPES =
  LIMITS?.ALLOWED_IMAGE_TYPES || [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

const IMAGE_MAX_MB =
  LIMITS?.IMAGE_MAX_SIZE_MB || 5;



const ok = (data, status = 200) =>
  Object.freeze({
    success: true,
    data,
    status,
  });

const fail = (err) =>
  Object.freeze({
    success: false,
    error:
      err?.message ||
      "Request failed",
    status: err?.status || 500,
    code: err?.code || "API_ERROR",
  });



const persistSession = (
  token,
  user,
  refreshToken
) => {
  try {
    if (token) {
      localStorage.setItem(
        TOKEN_KEY,
        token
      );
      setAuthToken(token);
    }

    if (user) {
      localStorage.setItem(
        USER_KEY,
        JSON.stringify(user)
      );
    }

    if (refreshToken) {
      localStorage.setItem(
        REFRESH_TOKEN_KEY,
        refreshToken
      );
    } else {
      localStorage.removeItem(
        REFRESH_TOKEN_KEY
      );
    }
  } catch {
    // ignore storage write failures
  }
};

const clearSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(
      REFRESH_TOKEN_KEY
    );
    localStorage.removeItem(USER_KEY);
    clearAuthToken();
  } catch {
    // ignore storage write failures
  }
};



const execute = async (fn) => {
  try {
    const res = await fn();
    return ok(res.data, res.status);
  } catch (err) {
    if (
      import.meta.env.MODE !== "production"
    ) {
      console.error(
        "UserService Error:",
        err
      );
    }
    return fail(err);
  }
};



export const registerUser = (payload) => {
  if (!payload) {
    return fail({
      message: "Payload required",
    });
  }

  return execute(() =>
    api.post(
      ENDPOINTS.AUTH_REGISTER,
      payload
    )
  );
};

export const loginUser = async (
  credentials
) => {
  if (!credentials) {
    return fail({
      message: "Credentials required",
    });
  }

  const result = await execute(() =>
    api.post(
      ENDPOINTS.AUTH_LOGIN,
      credentials
    )
  );

  if (
    result.success &&
    result.data?.token
  ) {
    persistSession(
      result.data.token,
      result.data.user,
      result.data.refreshToken
    );
  }

  return result;
};

export const logoutUser = () => {
  clearSession();
  return ok(null);
};



export const getMyProfile = () =>
  execute(() =>
    api.get(ENDPOINTS.USERS_ME)
  );

export const updateMyProfile = (
  payload
) => {
  if (!payload) {
    return fail({
      message: "Payload required",
    });
  }

  return execute(() =>
    api.put(
      ENDPOINTS.USERS_ME,
      payload
    )
  );
};

/**
 * Delete current user account
 * (Server removes related data)
 */
export const deleteMyAccount = () =>
  execute(() => api.delete(ENDPOINTS.USERS_ME));



export const uploadProfilePicture = (
  file
) => {
  if (!file) {
    return fail({
      message: "No file provided",
    });
  }

  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type
    )
  ) {
    return fail({
      message:
        "Unsupported file type",
    });
  }

  if (
    file.size >
    IMAGE_MAX_MB * 1024 * 1024
  ) {
    return fail({
      message: `File exceeds ${IMAGE_MAX_MB}MB`,
    });
  }

  const form = new FormData();
  form.append("file", file);

  return execute(() =>
    api.post(
      `${ENDPOINTS.USERS_ME}/upload`,
      form,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    )
  );
};
