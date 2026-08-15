const SunatService = require('../services/SunatService');

class SunatController {
  static async getCompanyConfig(req, res) {
    try {
      const config = await SunatService.getCompanyConfig();
      res.json({ success: true, data: config });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async syncPendingBoletas(req, res) {
    try {
      const result = await SunatService.syncPendingBoletas();
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = SunatController;
