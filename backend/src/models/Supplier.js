const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Supplier = sequelize.define(
  "Supplier",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    company_name: { type: DataTypes.STRING(200), allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "suppliers", timestamps: true, underscored: true }
);

module.exports = Supplier;
