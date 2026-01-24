const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Product = sequelize.define(
  "Product",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_code: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(250), allowNull: false },
    unit: { type: DataTypes.STRING(40), allowNull: true },
    category: { type: DataTypes.STRING(120), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "products", timestamps: true, underscored: true }
);

module.exports = Product;
