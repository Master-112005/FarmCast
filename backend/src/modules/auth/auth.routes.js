"use strict";

const express = require("express");

const validate =
  require("../../middlewares/validate.middleware");

const authController =
  require("./auth.controller");

const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require("./auth.schema");



const router = express.Router();



if (!authController) {
  throw new Error(
    "AuthController not found"
  );
}






router.post(
  "/register",
  validate({ body: registerSchema }),
  authController.register
);




router.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login
);




router.post(
  "/refresh",
  validate({ body: refreshSchema }),
  authController.refresh
);






router.post(
  "/logout",
  validate({ body: refreshSchema }),
  authController.logout
);



module.exports = Object.freeze(router);
