const { run, db } = require('../config/database');
const fs = require('fs');

async function cleanTest() {
  await run("DELETE FROM products WHERE barcode LIKE 'SKU-%'");
  await run("DELETE FROM categories WHERE name='ACCESORIOS'");
  if (fs.existsSync('test_sku.csv')) fs.unlinkSync('test_sku.csv');
  console.log('✅ Base de datos limpia de pruebas SKU.');
  db.close();
}

cleanTest();
