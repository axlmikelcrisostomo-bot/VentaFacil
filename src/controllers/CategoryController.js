const CategoryModel = require('../models/CategoryModel');

class CategoryController {
  static async getAll(req, res) {
    try {
      const categories = await CategoryModel.getAll();
      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const result = await CategoryModel.create(req.body);
      res.status(201).json({ success: true, id: result.lastID });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async update(req, res) {
    try {
      await CategoryModel.update(req.params.id, req.body);
      res.json({ success: true, message: 'Categoría actualizada' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      await CategoryModel.delete(req.params.id);
      res.json({ success: true, message: 'Categoría eliminada' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = CategoryController;
