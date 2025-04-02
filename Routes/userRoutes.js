const express = require("express");
const {
  loginController,
  registerController,
  fetchAllUsersController,
  resetIndexesController
} = require("../Controllers/userController");

const { protect } = require("../middleware/authMiddleware");

const Router = express.Router();

Router.post("/login", loginController);
Router.post("/register", registerController);
Router.get("/", protect, fetchAllUsersController);
Router.post("/reset-indexes", resetIndexesController);

module.exports = Router;