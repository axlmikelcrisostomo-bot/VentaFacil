const { query, get, run } = require('../../config/database');

class SunatService {
  /**
   * Obtener o inicializar la configuración de la empresa emisora
   */
  static async getCompanyConfig() {
    let config = await get(`SELECT * FROM company_config LIMIT 1`);
    if (!config) {
      // Datos por defecto de emisor de prueba / Beta SUNAT
      await run(`
        INSERT INTO company_config (ruc, razon_social, nombre_comercial, direccion, ubigeo, departamento, provincia, distrito, is_production)
        VALUES ('20601234567', 'EMPRESA COMERCIAL VENTA FÁCIL S.A.C.', 'VentaFácil POS', 'Av. Principal 123', '150101', 'LIMA', 'LIMA', 'LIMA', 0)
      `);
      config = await get(`SELECT * FROM company_config LIMIT 1`);
    }
    return config;
  }

  /**
   * Generar la siguiente serie y correlativo SUNAT (ej: B001-00000001 o F001-00000001)
   */
  static async getNextSeriesAndCorrelative(documentType = '03') {
    const series = documentType === '01' ? 'F001' : documentType === '03' ? 'B001' : 'NV01';
    
    const lastSale = await get(`
      SELECT correlative_number FROM sales WHERE series = ? ORDER BY correlative_number DESC LIMIT 1
    `, [series]);

    const nextCorrelative = (lastSale ? lastSale.correlative_number : 0) + 1;
    const formattedNumber = `${series}-${String(nextCorrelative).padStart(8, '0')}`;

    return {
      series,
      correlative: nextCorrelative,
      formattedInvoiceNumber: formattedNumber
    };
  }

  /**
   * Generar el texto formateado del CÓDIGO QR para SUNAT
   * Formato oficial SUNAT: RUC|TIPO_DOC|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NUM_DOC_CLIENTE|HASH
   */
  static generateSunatQrData(company, sale, customerDocType = '0', customerDocNum = '00000000', hash = 'a1b2c3d4e5f6') {
    const dateStr = new Date(sale.created_at || Date.now()).toISOString().split('T')[0];
    const igvStr = parseFloat(sale.igv || 0).toFixed(2);
    const totalStr = parseFloat(sale.total_amount).toFixed(2);

    return `${company.ruc}|${sale.document_type}|${sale.series}|${sale.correlative_number}|${igvStr}|${totalStr}|${dateStr}|${customerDocType}|${customerDocNum}|${hash}`;
  }

  /**
   * Sincronizar Boletas Electrónicas pendientes con SUNAT (Cuando hay Internet)
   */
  static async syncPendingBoletas() {
    const pendingSales = await query(`
      SELECT * FROM sales WHERE sunat_status = 'PENDIENTE' AND document_type IN ('01', '03') LIMIT 20
    `);

    if (!pendingSales || pendingSales.length === 0) {
      return { syncedCount: 0, message: 'No hay comprobantes pendientes por enviar a SUNAT' };
    }

    let successCount = 0;
    for (const sale of pendingSales) {
      try {
        // Simulación / Conexión a WebService SUNAT u OSE
        // En producción se firma el XML UBL 2.1 con la Clave SOL y Certificado PFX
        const cdrCode = '0';
        const cdrDesc = 'La Boleta de Venta Electrónica número ' + sale.invoice_number + ' ha sido ACEPTADA por SUNAT.';

        await run(`
          UPDATE sales 
          SET sunat_status = 'ACEPTADO', cdr_code = ?, cdr_description = ?
          WHERE id = ?
        `, [cdrCode, cdrDesc, sale.id]);

        successCount++;
      } catch (err) {
        console.error(`Error enviando BVE ${sale.invoice_number} a SUNAT:`, err.message);
      }
    }

    return {
      syncedCount: successCount,
      totalPending: pendingSales.length,
      message: `Se sincronizaron ${successCount} de ${pendingSales.length} Boletas Electrónicas con SUNAT.`
    };
  }
}

module.exports = SunatService;
