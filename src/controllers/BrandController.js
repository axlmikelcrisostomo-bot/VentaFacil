const BrandModel = require('../models/BrandModel');

class BrandController {
  static async getAll(req, res) {
    try {
      const brands = await BrandModel.getAll();
      res.json({ success: true, data: brands });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const brand = await BrandModel.getById(req.params.id);
      if (!brand) {
        return res.status(404).json({ success: false, message: 'Marca no encontrada' });
      }
      res.json({ success: true, data: brand });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const result = await BrandModel.create(req.body);
      res.status(201).json({ success: true, message: 'Marca creada exitosamente', id: result.lastID });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async update(req, res) {
    try {
      await BrandModel.update(req.params.id, req.body);
      res.json({ success: true, message: 'Marca actualizada exitosamente' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      await BrandModel.delete(req.params.id);
      res.json({ success: true, message: 'Marca eliminada exitosamente' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = BrandController;
