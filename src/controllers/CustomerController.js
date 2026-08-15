const CustomerModel = require('../models/CustomerModel');

class CustomerController {
  static async getAll(req, res) {
    try {
      const customers = await CustomerModel.getAll();
      res.json({ success: true, data: customers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const result = await CustomerModel.create(req.body);
      res.status(201).json({ success: true, id: result.lastID, message: 'Cliente registrado' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async update(req, res) {
    try {
      await CustomerModel.update(req.params.id, req.body);
      res.json({ success: true, message: 'Cliente actualizado' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      await CustomerModel.delete(req.params.id);
      res.json({ success: true, message: 'Cliente eliminado' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async registerPayment(req, res) {
    try {
      const result = await CustomerModel.registerPayment(req.body);
      res.json({ success: true, message: 'Abono registrado con éxito', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getCreditHistory(req, res) {
    try {
      const history = await CustomerModel.getCreditHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = CustomerController;
