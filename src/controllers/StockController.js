const StockModel = require('../models/StockModel');

class StockController {
  static async registerMovement(req, res) {
    try {
      const result = await StockModel.registerMovement(req.body);
      res.status(201).json({ success: true, message: 'Movimiento de stock registrado', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getLowStockAlerts(req, res) {
    try {
      const alerts = await StockModel.getLowStockAlerts();
      res.json({ success: true, data: alerts });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getMovements(req, res) {
    try {
      const { product_id, limit } = req.query;
      const movements = await StockModel.getMovements({
        product_id: product_id ? parseInt(product_id, 10) : null,
        limit: limit ? parseInt(limit, 10) : 50
      });
      res.json({ success: true, data: movements });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = StockController;
