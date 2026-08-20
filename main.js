const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { initDatabase } = require('./config/database');
const { seed } = require('./database/seeders');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Controladores
const ProductController = require('./src/controllers/ProductController');
const CategoryController = require('./src/controllers/CategoryController');
const BrandController = require('./src/controllers/BrandController');
const SaleController = require('./src/controllers/SaleController');
const CustomerController = require('./src/controllers/CustomerController');
const StockController = require('./src/controllers/StockController');
const SunatController = require('./src/controllers/SunatController');
const PrinterController = require('./src/controllers/PrinterController');

let mainWindow;

function startInternalServer() {
  return new Promise((resolve, reject) => {
    const serverApp = express();
    const PORT = 3000;

    serverApp.use(cors());
    serverApp.use(bodyParser.json({ limit: '50mb' }));
    serverApp.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

    // Deshabilitar caché HTTP para recargas siempre frescas
    serverApp.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    serverApp.use(express.static(path.join(__dirname, 'src', 'public'), {
      etag: false,
      maxAge: 0
    }));

    // Rutas API
    serverApp.get('/api/products', ProductController.getAll);
    serverApp.get('/api/products/barcode/:barcode', ProductController.getByBarcode);
    serverApp.post('/api/products', ProductController.create);
    serverApp.post('/api/products/import-csv', ProductController.importCSV);
    serverApp.post('/api/products/clear-catalog', ProductController.clearCatalog);
    serverApp.put('/api/products/:id', ProductController.update);
    serverApp.delete('/api/products/:id', ProductController.delete);

    serverApp.get('/api/categories', CategoryController.getAll);
    serverApp.post('/api/categories', CategoryController.create);
    serverApp.put('/api/categories/:id', CategoryController.update);
    serverApp.delete('/api/categories/:id', CategoryController.delete);

    serverApp.get('/api/brands', BrandController.getAll);
    serverApp.get('/api/brands/:id', BrandController.getById);
    serverApp.post('/api/brands', BrandController.create);
    serverApp.put('/api/brands/:id', BrandController.update);
    serverApp.delete('/api/brands/:id', BrandController.delete);

    serverApp.post('/api/stock/movement', StockController.registerMovement);
    serverApp.get('/api/stock/alerts', StockController.getLowStockAlerts);
    serverApp.get('/api/stock/movements', StockController.getMovements);

    serverApp.get('/api/customers', CustomerController.getAll);
    serverApp.post('/api/customers', CustomerController.create);
    serverApp.put('/api/customers/:id', CustomerController.update);
    serverApp.delete('/api/customers/:id', CustomerController.delete);
    serverApp.post('/api/customers/payment', CustomerController.registerPayment);
    serverApp.get('/api/customers/:id/history', CustomerController.getCreditHistory);

    serverApp.get('/api/sunat/config', SunatController.getCompanyConfig);
    serverApp.post('/api/sunat/sync', SunatController.syncPendingBoletas);

    serverApp.post('/api/sales', SaleController.createSale);
    serverApp.get('/api/sales', SaleController.getAll);
    serverApp.get('/api/sales/:id', SaleController.getById);
    serverApp.get('/api/sales/:id/ticket', SaleController.getTicketText);
    serverApp.get('/api/sales/:id/escpos', SaleController.getEscPosBytes);
    serverApp.post('/api/sales/:id/cancel', SaleController.cancelSale);

    // 8. Impresora Térmica 58mm / 80mm
    serverApp.get('/api/printers', PrinterController.getPrinters);
    serverApp.post('/api/printers/test', PrinterController.testPrint);
    serverApp.post('/api/sales/:id/print', PrinterController.printSaleTicket);

    serverApp.listen(PORT, () => {
      console.log(`Servidor SQLite offline ejecutándose internamente en puerto ${PORT}`);
      resolve();
    });
  });
}

async function createWindow() {
  await initDatabase();
  await seed();
  await startInternalServer();

  // Limpiar caché de sesión de Electron de forma segura
  if (session.defaultSession) {
    session.defaultSession.clearCache().catch(() => {});
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'VentaFácil - POS de Escritorio (Facturación Electrónica SUNAT BVE + Fiados + Peso)',
    icon: path.join(__dirname, 'src', 'public', 'favicon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    }
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
