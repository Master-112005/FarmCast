/**
 * communityService.js
 * ------------------------------------------------------
 * Community API service
 */

"use strict";

import api from "./api";
import { ENDPOINTS, LIMITS } from "../utils/constants";

const IMAGE_MAX_MB =
  LIMITS?.IMAGE_MAX_SIZE_MB || 5;

const ALLOWED_IMAGE_TYPES =
  LIMITS?.ALLOWED_IMAGE_TYPES || [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ];

const ok = (data, status = 200) => ({
  success: true,
  data,
  status,
});

const fail = (error) => ({
  success: false,
  error:
    error?.message || "Community request failed",
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

export const getCommunityPosts = (
  limit = 50
) => {
  const endpoint = ENDPOINTS?.COMMUNITY;
  if (!endpoint) {
    return fail({
      message:
        "Community endpoint not configured",
    });
  }

  return execute(() =>
    api.get(`${endpoint}/posts`, {
      params: { limit },
    })
  );
};

export const createCommunityPost = ({
  caption,
  file,
}) => {
  const endpoint = ENDPOINTS?.COMMUNITY;
  if (!endpoint) {
    return fail({
      message:
        "Community endpoint not configured",
    });
  }

  const normalizedCaption = String(
    caption || ""
  ).trim();

  const hasCaption =
    normalizedCaption.length > 0;
  const hasImage = Boolean(file);

  if (!hasCaption && !hasImage) {
    return fail({
      message:
        "Add a caption or image before posting",
    });
  }

  if (hasImage) {
    if (
      !ALLOWED_IMAGE_TYPES.includes(file.type)
    ) {
      return fail({
        message: "Unsupported image type",
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
  }

  const form = new FormData();
  if (hasCaption) {
    form.append("caption", normalizedCaption);
  }
  if (hasImage) {
    form.append("file", file);
  }

  return execute(() =>
    api.post(`${endpoint}/posts`, form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
  );
};

export const deleteCommunityPost = (postId) => {
  const endpoint = ENDPOINTS?.COMMUNITY;
  if (!endpoint) {
    return fail({
      message:
        "Community endpoint not configured",
    });
  }

  const normalizedId = String(postId || "").trim();
  if (!normalizedId) {
    return fail({
      message: "Post ID is required",
    });
  }

  return execute(() =>
    api.delete(
      `${endpoint}/posts/${normalizedId}`
    )
  );
};
