const { query, get, run } = require('../../config/database');

class CategoryModel {
  // 1. Obtener todas las categorías
  static async getAll() {
    const sql = `SELECT * FROM categories ORDER BY name ASC`;
    return await query(sql);
  }

  // 2. Obtener categoría por ID
  static async getById(id) {
    const sql = `SELECT * FROM categories WHERE id = ?`;
    return await get(sql, [id]);
  }

  // 3. Crear categoría
  static async create({ name, description }) {
    const sql = `INSERT INTO categories (name, description) VALUES (?, ?)`;
    return await run(sql, [name, description || '']);
  }

  // 4. Actualizar categoría
  static async update(id, { name, description }) {
    const sql = `UPDATE categories SET name = ?, description = ? WHERE id = ?`;
    return await run(sql, [name, description, id]);
  }

  // 5. Eliminar categoría
  static async delete(id) {
    const sql = `DELETE FROM categories WHERE id = ?`;
    return await run(sql, [id]);
  }
}

module.exports = CategoryModel;
