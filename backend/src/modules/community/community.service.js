/**
 * src/modules/community/community.service.js
 * ------------------------------------------------------
 * Community Domain Service
 */

"use strict";

const fs = require("fs");
const path = require("path");

const env = require("../../config/env");
const db = require("../../models");
const {
  ERROR_CODES,
  ROLES,
} = require("../../utils/constants");

const domainError = (
  code,
  message,
  status = 400
) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(
    Math.max(Math.round(parsed), 1),
    100
  );
};

const toImageUrl = (imagePath) => {
  const baseUrl = String(
    env.APP_BASE_URL || ""
  ).replace(/\/$/, "");

  if (!imagePath) return null;

  const normalizedPath = String(
    imagePath
  ).replace(/\\/g, "/");

  return `${baseUrl}/uploads/${normalizedPath}`;
};

const mapPost = (post) => {
  const plain = post?.get
    ? post.get({ plain: true })
    : post || {};

  return {
    id: plain.id,
    caption: plain.caption,
    imageUrl: toImageUrl(plain.imagePath),
    createdAt: plain.createdAt,
    author: {
      id: plain.author?.id || plain.userId || null,
      name: plain.author?.name || "User",
      role: plain.author?.role || "user",
      profileImage:
        plain.author?.profileImage || null,
    },
  };
};

const resolveUploadPath = (imagePath) =>
  path.resolve(
    process.cwd(),
    env.UPLOADS.DIR,
    String(imagePath || "")
  );

const deleteImageIfExists = async (imagePath) => {
  if (!imagePath) return;

  try {
    await fs.promises.unlink(
      resolveUploadPath(imagePath)
    );
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
};

const listPosts = async (options = {}) => {
  if (!db.CommunityPost) {
    return [];
  }

  const limit = normalizeLimit(options.limit);
  const rows = await db.CommunityPost.findAll({
    include: [
      {
        model: db.User,
        as: "author",
        attributes: [
          "id",
          "name",
          "role",
          "profileImage",
        ],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
  });

  return rows.map(mapPost);
};

const createPost = async (
  currentUser,
  payload,
  file
) => {
  if (!currentUser?.id) {
    throw domainError(
      ERROR_CODES.AUTH_REQUIRED,
      "Authentication required",
      401
    );
  }

  const normalizedCaption = String(
    payload?.caption || ""
  ).trim();
  const caption = normalizedCaption || null;
  const imagePath = file?.filename
    ? `community/${file.filename}`
    : null;

  if (!caption && !imagePath) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Provide a caption or image",
      400
    );
  }

  const created = await db.CommunityPost.create({
    userId: currentUser.id,
    caption,
    imagePath,
  });

  const withAuthor =
    await db.CommunityPost.findByPk(created.id, {
      include: [
        {
          model: db.User,
          as: "author",
          attributes: [
            "id",
            "name",
            "role",
            "profileImage",
          ],
          required: false,
        },
      ],
    });

  return mapPost(withAuthor || created);
};

const deletePost = async (
  currentUser,
  postId
) => {
  if (!currentUser?.id) {
    throw domainError(
      ERROR_CODES.AUTH_REQUIRED,
      "Authentication required",
      401
    );
  }

  const post = await db.CommunityPost.findByPk(
    postId,
    {
      attributes: ["id", "userId", "imagePath"],
    }
  );

  if (!post) {
    throw domainError(
      ERROR_CODES.RESOURCE_NOT_FOUND,
      "Community post not found",
      404
    );
  }

  const isOwner = post.userId === currentUser.id;
  const isAdmin =
    currentUser.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw domainError(
      ERROR_CODES.ACCESS_DENIED,
      "You can delete only your posts",
      403
    );
  }

  await deleteImageIfExists(post.imagePath);
  await post.destroy();

  return {
    id: post.id,
    deleted: true,
  };
};

module.exports = {
  listPosts,
  createPost,
  deletePost,
};
