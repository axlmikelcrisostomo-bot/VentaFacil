const { formatTicket58mm } = require('../utils/receiptFormatter');
const SaleModel = require('../models/SaleModel');

class PrinterService {
  /**
   * Generar texto plano formateado a 32 columnas para impresora de 58 mm
   */
  static async getTicketFormattedText(saleId) {
    const sale = await SaleModel.getById(saleId);
    if (!sale) {
      throw new Error(`No se encontró la venta con ID ${saleId}`);
    }
    return formatTicket58mm(sale);
  }

  /**
   * Generar Comandos ESC/POS en formato Buffer de Bytes para impresoras USB / Serial
   */
  static async getEscPosBuffer(saleId) {
    const text = await this.getTicketFormattedText(saleId);
    
    // Comandos ESC/POS Estándar
    const ESC = 0x1b;
    const GS = 0x1d;

    const initPrinter = Buffer.from([ESC, 0x40]); // ESC @ (Inicializar)
    const alignCenter = Buffer.from([ESC, 0x61, 0x01]); // ESC a 1 (Centrar)
    const alignLeft = Buffer.from([ESC, 0x61, 0x00]); // ESC a 0 (Izquierda)
    const cutPaper = Buffer.from([GS, 0x56, 0x41, 0x03]); // GS V (Cortar papel parcial/total)

    const contentBuffer = Buffer.from(text, 'ascii');

    return Buffer.concat([initPrinter, contentBuffer, cutPaper]);
  }
}

module.exports = PrinterService;
