const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PriceUpdate = sequelize.define(
  "PriceUpdate",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    price: { type: DataTypes.DECIMAL(14, 4), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false },
    effective_date: { type: DataTypes.DATEONLY, allowNull: false },
    source: {
      type: DataTypes.ENUM("portal", "excel", "api"),
      allowNull: false,
      defaultValue: "portal",
    },
  },
  { tableName: "price_updates", timestamps: true, underscored: true }
);

module.exports = PriceUpdate;
