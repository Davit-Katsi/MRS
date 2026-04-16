const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Supplier = require("../models/Supplier");
const crypto = require("crypto");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * One-time endpoint:
 * Creates the first admin if none exists.
 */
exports.registerFirstAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    const existingAdmin = await User.findOne({ where: { role: "admin" } });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user = User.build({ name, email, role: "admin", password_hash: "temp" });
    await user.setPassword(password);
    await user.save();

    return res.status(201).json({ message: "Admin created", adminId: user.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email and password are required" });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.active) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await user.checkPassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // If supplier user, get supplierId for convenience
    let supplierId = null;
    if (user.role === "supplier") {
      const supplier = await Supplier.findOne({ where: { user_id: user.id } });
      supplierId = supplier ? supplier.id : null;
    }

    const token = signToken({ id: user.id, role: user.role, supplierId });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, supplierId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ where: { email } });

    // Security: don't reveal whether the email exists
    if (!user || !user.active) {
      return res.json({ message: "If the email exists, a reset link will be generated." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    user.reset_token_hash = tokenHash;
    user.reset_token_expires = expires;
    await user.save();

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
    const link = `${baseUrl}/reset-password?token=${rawToken}`;

    // Demo/simple: print reset link in logs
    console.log("🔐 Password reset link:", link);

    return res.json({ message: "If the email exists, a reset link will be generated." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ message: "token and newPassword are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const tokenHash = hashResetToken(token);

    const user = await User.findOne({ where: { reset_token_hash: tokenHash } });
    if (!user || !user.reset_token_expires) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    if (new Date(user.reset_token_expires).getTime() < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await user.setPassword(newPassword);

    user.reset_token_hash = null;
    user.reset_token_expires = null;
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
