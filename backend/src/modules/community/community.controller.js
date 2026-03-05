"use strict";

const communityService = require("./community.service");
const response = require("../../utils/response");

const listPosts = async (req, res, next) => {
  try {
    const posts = await communityService.listPosts({
      limit: req.query.limit,
    });
    return response.success(res, posts);
  } catch (err) {
    next(err);
  }
};

const createPost = async (req, res, next) => {
  try {
    const created = await communityService.createPost(
      req.user,
      req.body,
      req.file
    );
    return response.created(res, created);
  } catch (err) {
    next(err);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const result = await communityService.deletePost(
      req.user,
      req.params.postId
    );
    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPosts,
  createPost,
  deletePost,
};
