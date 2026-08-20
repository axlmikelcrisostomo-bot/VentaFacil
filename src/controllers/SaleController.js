const SaleModel = require('../models/SaleModel');
const PrinterService = require('../services/PrinterService');

class SaleController {
  static async createSale(req, res) {
    try {
      const sale = await SaleModel.createSale(req.body);
      const receiptText = await PrinterService.getTicketFormattedText(sale.saleId);
      res.status(201).json({
        success: true,
        message: 'Venta realizada con éxito',
        data: {
          ...sale,
          id: sale.id || sale.saleId,
          saleId: sale.saleId || sale.id
        },
        receiptText
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const sale = await SaleModel.getById(req.params.id);
      if (!sale) {
        return res.status(404).json({ success: false, error: 'Venta no encontrada' });
      }
      res.json({ success: true, data: sale });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getAll(req, res) {
    try {
      const sales = await SaleModel.getAll({ limit: parseInt(req.query.limit || 50, 10) });
      res.json({ success: true, data: sales });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getTicketText(req, res) {
    try {
      const ticketText = await PrinterService.getTicketFormattedText(req.params.id);
      res.json({ success: true, ticketText });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getEscPosBytes(req, res) {
    try {
      const buffer = await PrinterService.getEscPosBuffer(req.params.id);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename=ticket_${req.params.id}_58mm.bin`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async cancelSale(req, res) {
    try {
      await SaleModel.cancelSale(req.params.id);
      res.json({ success: true, message: 'Venta anulada y stock devuelto exitosamente' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = SaleController;
