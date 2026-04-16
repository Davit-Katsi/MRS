const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register-first-admin", authController.registerFirstAdmin);
router.post("/login", authController.login);
router.post("/request-reset", authController.requestPasswordReset);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
