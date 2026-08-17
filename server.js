const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const { initDatabase } = require('./config/database');
const { seed } = require('./database/seeders');

// Controladores
const ProductController = require('./src/controllers/ProductController');
const CategoryController = require('./src/controllers/CategoryController');
const BrandController = require('./src/controllers/BrandController');
const SaleController = require('./src/controllers/SaleController');
const CustomerController = require('./src/controllers/CustomerController');
const StockController = require('./src/controllers/StockController');
const SunatController = require('./src/controllers/SunatController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'src', 'public')));

// ==========================================
// RUTAS DE LA API DE ESCRITORIO
// ==========================================

// 1. Productos (CRUD + Escáner + Importación CSV)
app.get('/api/products', ProductController.getAll);
app.get('/api/products/barcode/:barcode', ProductController.getByBarcode);
app.post('/api/products', ProductController.create);
app.post('/api/products/import-csv', ProductController.importCSV);
app.put('/api/products/:id', ProductController.update);
app.delete('/api/products/:id', ProductController.delete);

// 2. Categorías (CRUD)
app.get('/api/categories', CategoryController.getAll);
app.post('/api/categories', CategoryController.create);
app.put('/api/categories/:id', CategoryController.update);
app.delete('/api/categories/:id', CategoryController.delete);

// 3. Marcas (CRUD)
app.get('/api/brands', BrandController.getAll);
app.get('/api/brands/:id', BrandController.getById);
app.post('/api/brands', BrandController.create);
app.put('/api/brands/:id', BrandController.update);
app.delete('/api/brands/:id', BrandController.delete);

// 4. Control de Stock / Kárdex
app.post('/api/stock/movement', StockController.registerMovement);
app.get('/api/stock/alerts', StockController.getLowStockAlerts);
app.get('/api/stock/movements', StockController.getMovements);

// 5. Clientes y FIADOS
app.get('/api/customers', CustomerController.getAll);
app.post('/api/customers', CustomerController.create);
app.put('/api/customers/:id', CustomerController.update);
app.delete('/api/customers/:id', CustomerController.delete);
app.post('/api/customers/payment', CustomerController.registerPayment);
app.get('/api/customers/:id/history', CustomerController.getCreditHistory);

// 6. Facturación Electrónica SUNAT (BVE)
app.get('/api/sunat/config', SunatController.getCompanyConfig);
app.post('/api/sunat/sync', SunatController.syncPendingBoletas);

// 7. Ventas & Ticket 58mm
app.post('/api/sales', SaleController.createSale);
app.get('/api/sales', SaleController.getAll);
app.get('/api/sales/:id', SaleController.getById);
app.get('/api/sales/:id/ticket', SaleController.getTicketText);
app.get('/api/sales/:id/escpos', SaleController.getEscPosBytes);

// Inicializar la Base de Datos SQLite y servidor
async function start() {
  try {
    await initDatabase();
    await seed();

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 APLICACIÓN VENTA FÁCIL (ESCRITORIO - OFFLINE/SUNAT BVE)`);
      console.log(`URL local: http://localhost:${PORT}`);
      console.log(`Módulos: Escáner, Ticket 58mm, Fiados, Crudos y SUNAT BVE`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Error iniciando el servidor:', err);
  }
}

start();
