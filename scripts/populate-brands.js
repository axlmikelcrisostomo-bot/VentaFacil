const { query, run, get, db } = require('../config/database');

async function populateBrands() {
  try {
    console.log('🏷️ Extrayendo y creando la tabla de Marcas (brands)...');

    // 1. Asegurar que la tabla y la columna existan
    await run(`
      CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await run('ALTER TABLE products ADD COLUMN brand_id INTEGER');
    } catch (e) {
      // Ignorar si la columna brand_id ya existe
    }

    // 2. Obtener todas las marcas distintas actualmente en products
    const productsWithBrand = await query("SELECT id, brand FROM products WHERE brand IS NOT NULL AND TRIM(brand) != ''");

    let brandCount = 0;
    let linkedCount = 0;

    for (const p of productsWithBrand) {
      const brandName = p.brand.trim();
      let brandObj = await get('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)', [brandName]);

      if (!brandObj) {
        const res = await run('INSERT INTO brands (name, description) VALUES (?, ?)', [brandName, 'Marca registrada']);
        brandObj = { id: res.lastID };
        brandCount++;
        console.log(`  ✨ Marca creada: "${brandName}"`);
      }

      await run('UPDATE products SET brand_id = ? WHERE id = ?', [brandObj.id, p.id]);
      linkedCount++;
    }

    console.log('\n====================================================');
    console.log(`✅ TABLA MARCAS (brands) CREADA Y VINCULADA:`);
    console.log(`   🏷️ Marcas nuevas insertadas: ${brandCount}`);
    console.log(`   🔗 Productos vinculados a sus marcas: ${linkedCount}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Error al poblar marcas:', err);
  } finally {
    db.close();
  }
}

populateBrands();
