const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const bcrypt = require("bcrypt");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM("admin", "supplier"),
      allowNull: false,
      defaultValue: "supplier",
    },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    reset_token_hash: { type: DataTypes.STRING, allowNull: true },
    reset_token_expires: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "users", timestamps: true, underscored: true }
);

User.prototype.setPassword = async function (plainPassword) {
  const saltRounds = 10;
  this.password_hash = await bcrypt.hash(plainPassword, saltRounds);
};

User.prototype.checkPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password_hash);
};


module.exports = User;
