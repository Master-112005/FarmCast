"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const {
  CloudinaryStorage,
} = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");
const env = require("../config/env");
const logger = require("../utils/logger");



const ALLOWED_MIME = env.UPLOADS.ALLOWED_MIME;
const MAX_SIZE_BYTES =
  env.UPLOADS.MAX_SIZE_MB * 1024 * 1024;

const EXT_BY_MIME = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
});

const CLOUDINARY_FORMAT_BY_MIME = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});



const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const sanitizeExtension = (file) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext && ext.length <= 8) return ext;
  return EXT_BY_MIME[file.mimetype] || "";
};

const createUploader = (
  subDir,
  options = {}
) => {
  const requireFile =
    options.requireFile !== false;
  const resolveDir = () =>
    path.resolve(process.cwd(), env.UPLOADS.DIR, subDir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = resolveDir();
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = sanitizeExtension(file);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      const err = new Error("Unsupported file type");
      err.status = 400;
      cb(err);
      return;
    }
    cb(null, true);
  };

  const uploader = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_BYTES },
  });

  const middleware = (req, res, next) => {
    const handler = uploader.single("file");

    handler(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          err.status = 400;
          err.message = `File exceeds ${env.UPLOADS.MAX_SIZE_MB}MB`;
        } else if (!err.status) {
          err.status = 400;
        }
        return next(err);
      }

      if (requireFile && !req.file) {
        const error = new Error("File is required");
        error.status = 400;
        return next(error);
      }

      return next();
    });
  };

  return { middleware, resolveDir };
};

const createCloudinaryUploader = (
  folder,
  options = {}
) => {
  const requireFile =
    options.requireFile !== false;

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => ({
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      format:
        CLOUDINARY_FORMAT_BY_MIME[file.mimetype] ||
        undefined,
    }),
  });

  const fileFilter = (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      const err = new Error("Unsupported file type");
      err.status = 400;
      cb(err);
      return;
    }
    cb(null, true);
  };

  const uploader = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_BYTES },
  });

  const middleware = (req, res, next) => {
    const handler = uploader.single("file");

    handler(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          err.status = 400;
          err.message = `File exceeds ${env.UPLOADS.MAX_SIZE_MB}MB`;
        } else if (!err.status) {
          err.status = 400;
        }

        logger.warn("Cloudinary community upload failed", {
          message: err.message,
          code: err.code || null,
          status: err.status || null,
          folder,
        });
        return next(err);
      }

      if (requireFile && !req.file) {
        const error = new Error("File is required");
        error.status = 400;
        return next(error);
      }

      if (req.file) {
        logger.info("Cloudinary community upload succeeded", {
          originalName: req.file.originalname || null,
          mimeType: req.file.mimetype || null,
          sizeBytes: req.file.size || null,
          cloudinaryUrl: req.file.path || null,
          cloudinaryPublicId:
            req.file.filename || null,
          folder,
        });
      }

      return next();
    });
  };

  return { middleware };
};



const uploadProfileImage =
  createUploader("profiles");
const uploadPredictorImage =
  createUploader("predictors");
const uploadCommunityImage =
  createCloudinaryUploader("farmcast/community", {
    requireFile: false,
  });

module.exports = {
  uploadProfileImage: uploadProfileImage.middleware,
  uploadPredictorImage: uploadPredictorImage.middleware,
  uploadCommunityImage:
    uploadCommunityImage.middleware,
  resolveProfileDir: uploadProfileImage.resolveDir,
  resolvePredictorDir: uploadPredictorImage.resolveDir,
  resolveCommunityDir:
    uploadCommunityImage.resolveDir,
};
