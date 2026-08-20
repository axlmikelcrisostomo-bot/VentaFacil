const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { formatTicket58mm } = require('../utils/receiptFormatter');
const SaleModel = require('../models/SaleModel');

class PrinterController {
  /**
   * Obtener lista de impresoras instaladas en Windows
   */
  static async getPrinters(req, res) {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, PortName, DriverName, Default, WorkOffline | ConvertTo-Json"`;

    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      let printers = [];

      if (!error && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          printers = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          console.warn('No se pudo parsear salida JSON de impresoras:', e);
        }
      }

      if (printers.length === 0) {
        printers = [
          { Name: 'POS-58-Series', PortName: 'USB001', Default: true },
          { Name: 'POS-58 (Impresora Térmica 58mm)', PortName: 'USB001', Default: false },
          { Name: 'POS-80 (Impresora Térmica 80mm)', PortName: 'USB002', Default: false },
          { Name: 'Microsoft Print to PDF', PortName: 'PORTPROMPT:', Default: false }
        ];
      }

      res.json({
        success: true,
        data: printers,
        count: printers.length
      });
    });
  }

  /**
   * Enviar texto de ticket directamente a la impresora mediante el script PowerShell GDI
   */
  static sendToThermalPrinter(printerName, ticketText, paperWidth = 58, fontSize = 0, marginLeft = -1) {
    return new Promise((resolve) => {
      const tempPath = path.join(os.tmpdir(), `vf_ticket_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
      const scriptPath = path.join(__dirname, '..', 'utils', 'printTicket.ps1');

      try {
        fs.writeFileSync(tempPath, ticketText, 'utf8');
      } catch (err) {
        return resolve({ success: false, error: 'No se pudo crear archivo temporal: ' + err.message });
      }

      const safePrinter = (printerName || 'POS-58-Series').replace(/"/g, '`"');
      const widthNum = parseInt(paperWidth, 10) || 58;
      const fsVal = parseFloat(fontSize) || 0;
      const mlVal = parseInt(marginLeft, 10) >= 0 ? parseInt(marginLeft, 10) : -1;

      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${safePrinter}" -FilePath "${tempPath}" -PaperWidthMm ${widthNum} -CustomFontSize ${fsVal} -CustomMarginLeft ${mlVal}`;

      exec(psCmd, { timeout: 8000 }, (err, stdout, stderr) => {
        try { fs.unlinkSync(tempPath); } catch (_) {}

        if (err) {
          console.warn(`[Printer] Error al imprimir en ${safePrinter}:`, err.message);
          resolve({ success: false, error: err.message || stderr });
        } else {
          console.log(`[Printer] Ticket impreso exitosamente en: ${safePrinter}`);
          resolve({ success: true, output: stdout.trim() });
        }
      });
    });
  }

  /**
   * Generar e imprimir ticket de prueba
   */
  static async testPrint(req, res) {
    try {
      const { printerName = 'POS-58-Series', paperWidth = '58', ticketText = null, fontSize = 0, marginLeft = -1 } = req.body;
      const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

      const finalTicketText = ticketText || 
`================================
      VENTA FACIL POS
  PRUEBA DE IMPRESION CORRECTA
================================
Fecha: ${now}
Impresora: ${printerName}
Ancho de Papel: ${paperWidth}mm
Estado: CONECTADA Y SINCRONIZADA
--------------------------------
1x @ S/.1.00             S/.1.00
PRODUCTO DE PRUEBA
--------------------------------
TOTAL PAGADO:            S/.1.00
================================
  ¡IMPRESORA LISTA PARA VENTAS!
================================\n\n\n`;

      const result = await PrinterController.sendToThermalPrinter(printerName, finalTicketText, paperWidth, fontSize, marginLeft);

      if (result.success) {
        res.json({
          success: true,
          message: `Ticket de prueba enviado exitosamente a "${printerName}"`,
          printerName,
          paperWidth,
          ticketText: finalTicketText
        });
      } else {
        res.status(500).json({
          success: false,
          error: `Error al enviar a "${printerName}": ${result.error}`,
          printerName,
          paperWidth,
          ticketText: finalTicketText
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Imprimir ticket de una venta existente por ID
   */
  static async printSaleTicket(req, res) {
    try {
      const saleId = req.params.id;
      const { printerName = 'POS-58-Series', paperWidth = '58', fontSize = 0, marginLeft = -1 } = req.body;

      const sale = await SaleModel.getById(saleId);
      if (!sale) {
        return res.status(404).json({ success: false, error: `No se encontró la venta ${saleId}` });
      }

      const ticketText = formatTicket58mm(sale);
      const result = await PrinterController.sendToThermalPrinter(printerName, ticketText, paperWidth, fontSize, marginLeft);

      res.json({
        success: result.success,
        message: result.success ? `Ticket de venta impreso en "${printerName}"` : `Error: ${result.error}`,
        ticketText
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = PrinterController;
