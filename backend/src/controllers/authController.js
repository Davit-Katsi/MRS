const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Supplier = require("../models/Supplier");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
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
