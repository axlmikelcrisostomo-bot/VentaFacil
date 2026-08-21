const { query, run, db } = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Iniciando migración de base de datos a SKU como Primary Key...');

    // 1. Desactivar llaves foráneas temporalmente durante la migración
    await run('PRAGMA foreign_keys = OFF');

    // 2. Comprobar columnas actuales de products
    const tableInfo = await query('PRAGMA table_info(products)');
    const hasSkuCol = tableInfo.some(col => col.name === 'sku');
    const pkCol = tableInfo.find(col => col.pk === 1);

    if (hasSkuCol && pkCol && pkCol.name === 'sku') {
      console.log('✅ La tabla "products" ya tiene "sku" como Primary Key.');
      db.close();
      return;
    }

    console.log('📦 Extrayendo productos existentes para transformación...');
    const oldProducts = await query('SELECT * FROM products');
    console.log(`   Se encontraron ${oldProducts.length} productos en la base de datos.`);

    // 3. Crear tabla temporal products_new con sku como PRIMARY KEY
    await run(`
      CREATE TABLE IF NOT EXISTS products_new (
        sku TEXT PRIMARY KEY NOT NULL,
        barcode TEXT,
        name TEXT NOT NULL,
        brand_id INTEGER,
        category_id INTEGER,
        purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        sale_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        stock DECIMAL(10,3) NOT NULL DEFAULT 0.000,
        min_stock DECIMAL(10,3) DEFAULT 5.000,
        expiration_date TEXT,
        status TEXT DEFAULT 'DISPONIBLE',
        is_bulk INTEGER DEFAULT 0,
        unit_measure TEXT DEFAULT 'UNIDAD',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
      )
    `);

    // 4. Mapear e insertar productos asignando SKU y preservando barcode
    const barcodeToSkuMap = new Map();
    let skuCounter = 1;

    for (const p of oldProducts) {
      let finalSku = '';
      let finalBarcode = '';

      if (p.barcode && p.barcode.startsWith('SKU-')) {
        finalSku = p.barcode.trim();
        finalBarcode = p.sku ? p.sku.trim() : null;
      } else {
        finalSku = `SKU-${String(skuCounter).padStart(6, '0')}`;
        finalBarcode = p.barcode ? p.barcode.trim() : null;
        skuCounter++;
      }

      if (p.barcode) {
        barcodeToSkuMap.set(p.barcode, finalSku);
      }

      await run(`
        INSERT INTO products_new (
          sku, barcode, name, brand_id, category_id,
          purchase_price, sale_price, stock, min_stock,
          expiration_date, status, is_bulk, unit_measure,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        finalSku,
        finalBarcode,
        p.name,
        p.brand_id || null,
        p.category_id || null,
        p.purchase_price || 0,
        p.sale_price || 0,
        p.stock || 0,
        p.min_stock || 5,
        p.expiration_date || null,
        p.status || 'DISPONIBLE',
        p.is_bulk ? 1 : 0,
        p.unit_measure || 'UNIDAD',
        p.is_active !== undefined ? p.is_active : 1,
        p.created_at || new Date().toISOString(),
        p.updated_at || new Date().toISOString()
      ]);
    }

    // 5. Actualizar referencias en stock_movements y sale_details
    for (const [oldBarcode, newSku] of barcodeToSkuMap.entries()) {
      await run('UPDATE stock_movements SET product_id = ? WHERE product_id = ?', [newSku, oldBarcode]);
      await run('UPDATE sale_details SET product_id = ? WHERE product_id = ?', [newSku, oldBarcode]);
    }

    // 6. Eliminar tabla vieja y renombrar
    await run('DROP TABLE products');
    await run('ALTER TABLE products_new RENAME TO products');

    // 7. Recrear índices
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
    await run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
    await run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
    await run('CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');

    // 8. Reactivar foreign keys
    await run('PRAGMA foreign_keys = ON');

    console.log('====================================================');
    console.log(`✅ MIGRACIÓN COMPLETADA EXITOSAMENTE:`);
    console.log(`   ✨ ${oldProducts.length} productos migrados al nuevo esquema con SKU como PK.`);
    console.log(`   🏷️ Códigos de barra originales preservados en la columna "barcode".`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Error durante la migración:', err);
  } finally {
    db.close();
  }
}

migrate();
