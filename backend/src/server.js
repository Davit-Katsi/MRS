const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
require("dotenv").config({ quiet: true });
const adminRoutes = require("./routes/adminRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const reportRoutes = require("./routes/reportRoutes");

const { sequelize } = require("./models");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/reports", reportRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", project: "MRS backend" });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    await sequelize.sync();
    console.log("✅ Tables synced");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`MRS backend running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Startup error:", err);
    process.exit(1);
  }
}

start();
