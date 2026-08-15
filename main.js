const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./config/database');
const seedDatabase = require('./database/seeders');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Controladores
const ProductController = require('./src/controllers/ProductController');
const CategoryController = require('./src/controllers/CategoryController');
const SaleController = require('./src/controllers/SaleController');
const CustomerController = require('./src/controllers/CustomerController');
const StockController = require('./src/controllers/StockController');
const SunatController = require('./src/controllers/SunatController');

let mainWindow;

function startInternalServer() {
  return new Promise((resolve, reject) => {
    const serverApp = express();
    const PORT = 3000;

    serverApp.use(cors());
    serverApp.use(bodyParser.json());
    serverApp.use(express.static(path.join(__dirname, 'src', 'public')));

    // Rutas API
    serverApp.get('/api/products', ProductController.getAll);
    serverApp.get('/api/products/barcode/:barcode', ProductController.getByBarcode);
    serverApp.post('/api/products', ProductController.create);
    serverApp.post('/api/products/import-csv', ProductController.importCSV);
    serverApp.put('/api/products/:id', ProductController.update);
    serverApp.delete('/api/products/:id', ProductController.delete);

    serverApp.get('/api/categories', CategoryController.getAll);
    serverApp.post('/api/categories', CategoryController.create);
    serverApp.put('/api/categories/:id', CategoryController.update);
    serverApp.delete('/api/categories/:id', CategoryController.delete);

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

    serverApp.listen(PORT, () => {
      console.log(`Servidor SQLite offline ejecutándose internamente en puerto ${PORT}`);
      resolve();
    });
  });
}

async function createWindow() {
  await initDatabase();
  await seedDatabase();
  await startInternalServer();

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
      contextIsolation: false
    }
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('print-thermal-receipt', async (event, htmlContent) => {
  let printWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true }
  });

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  printWindow.webContents.on('did-finish-load', () => {
    printWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: ''
    }, (success, failureReason) => {
      if (!success) console.log('Resultado de impresión silenciosa:', failureReason);
      printWindow.close();
    });
  });
});
