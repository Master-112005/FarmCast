"use strict";

const db = require("../../models");

const getAlertModel = () => db.Alert;

module.exports = Object.freeze({
  getAlertModel,
});
