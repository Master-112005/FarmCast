"use strict";

const express = require("express");
const {
  authenticate,
} = require("../../middlewares/auth.middleware");
const {
  requireRole,
} = require("../../middlewares/rbac.middleware");
const validate =
  require("../../middlewares/validate.middleware");
const {
  uploadCommunityImage,
} = require("../../middlewares/upload.middleware");
const {
  USER_ROLES,
} = require("../users/user.constants");
const {
  listCommunityPostsQuerySchema,
  createCommunityPostSchema,
  communityPostParamsSchema,
} = require("./community.schema");
const communityController = require("./community.controller");

const router = express.Router();

router.get(
  "/posts",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ query: listCommunityPostsQuerySchema }),
  communityController.listPosts
);

router.post(
  "/posts",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  uploadCommunityImage,
  validate({ body: createCommunityPostSchema }),
  communityController.createPost
);

router.delete(
  "/posts/:postId",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: communityPostParamsSchema }),
  communityController.deletePost
);

module.exports = router;
