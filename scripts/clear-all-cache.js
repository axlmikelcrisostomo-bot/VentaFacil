const fs = require('fs');
const path = require('path');
const { run, query, db } = require('../config/database');

async function clearAppCacheAndDatabase() {
  console.log('=====================================================');
  console.log(' 🧹 LIMPIEZA TOTAL DE CACHÉ Y BASE DE DATOS LOCAL   ');
  console.log('=====================================================\n');

  try {
    // 1. Limpieza de tablas de productos, stock, ventas y créditos
    console.log('📦 1. Limpiando productos, movimientos y ventas...');
    await run('DELETE FROM sale_details');
    await run('DELETE FROM sales');
    await run('DELETE FROM credit_payments');
    await run('DELETE FROM stock_movements');
    await run('DELETE FROM products');
    
    // Opcional: reiniciar secuencias autoincrementables
    try {
      await run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_details', 'stock_movements', 'credit_payments')");
    } catch (_) {}

    // 2. Ejecutar VACUUM para compactar la base de datos
    console.log('🗜️ 2. Compactando base de datos SQLite (VACUUM)...');
    await run('VACUUM');

    console.log('✅ Base de datos SQLite reiniciada a 0 productos y movimientos.');

  } catch (err) {
    console.error('❌ Error limpiando base de datos:', err.message);
  } finally {
    db.close();
  }

  // 3. Limpieza de Caché de Electron en AppData
  console.log('\n🗑️ 3. Limpiando archivos temporales y caché de Electron...');
  const appDataPath = process.env.APPDATA || '';
  const electronAppDataDir = path.join(appDataPath, 'ventafacil');

  if (fs.existsSync(electronAppDataDir)) {
    const foldersToClean = [
      'Cache',
      'Code Cache',
      'DawnGraphiteCache',
      'DawnWebGPUCache',
      'GPUCache',
      'Local Storage',
      'Network',
      'Session Storage',
      'Shared Dictionary',
      'WebStorage',
      'blob_storage'
    ];

    for (const folder of foldersToClean) {
      const folderPath = path.join(electronAppDataDir, folder);
      if (fs.existsSync(folderPath)) {
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(`   ✓ Eliminada carpeta de caché: ${folder}`);
        } catch (e) {
          console.warn(`   ⚠️ No se pudo eliminar ${folder} (posible archivo en uso): ${e.message}`);
        }
      }
    }
  }

  console.log('\n=====================================================');
  console.log('✨ LIMPIEZA COMPLETA FINALIZADA CON ÉXITO');
  console.log('   La aplicación está 100% limpia y lista para importar');
  console.log('   su archivo CSV de inventario.');
  console.log('=====================================================\n');
}

clearAppCacheAndDatabase();
