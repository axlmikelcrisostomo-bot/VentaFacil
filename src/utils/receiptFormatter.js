/**
 * Formateador de Comprobantes Térmicos de 58 mm (SUNAT BVE / ESC/POS)
 * Ancho máximo de línea estándar en 58mm: 32 Caracteres
 */

const LINE_WIDTH = 32;

function centerText(text, width = LINE_WIDTH) {
  if (text.length >= width) return text.substring(0, width);
  const leftPadding = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPadding) + text;
}

function justifyBetween(leftText, rightText, width = LINE_WIDTH) {
  const maxLeft = width - rightText.length - 1;
  const truncatedLeft = leftText.length > maxLeft ? leftText.substring(0, maxLeft) : leftText;
  const spaces = width - (truncatedLeft.length + rightText.length);
  return truncatedLeft + ' '.repeat(Math.max(1, spaces)) + rightText;
}

function divider(char = '-', width = LINE_WIDTH) {
  return char.repeat(width);
}

function formatTicket58mm(sale) {
  const lines = [];

  const isBve = sale.document_type === '03';
  const isFactura = sale.document_type === '01';
  const docTitle = isFactura ? "FACTURA ELECTRÓNICA" : isBve ? "BOLETA DE VENTA ELECTRÓNICA" : "TICKET DE VENTA";

  // 1. ENCABEZADO FISCAL EMISOR (SUNAT)
  lines.push(centerText("EMPRESA COMERCIAL VENTA FÁCIL S.A.C."));
  lines.push(centerText("RUC: 20601234567"));
  lines.push(centerText("Av. Principal #123 - Lima"));
  lines.push(divider("="));

  // 2. DATOS DEL COMPROBANTE Y CLIENTE
  lines.push(centerText(docTitle));
  lines.push(centerText(sale.invoice_number));
  lines.push(divider("-"));
  lines.push(`FECHA:   ${new Date(sale.created_at || Date.now()).toLocaleString()}`);
  lines.push(`CAJERO:  ${sale.cashier_name || 'Cajero Principal'}`);
  lines.push(`CLIENTE: ${sale.customer_name || 'CLIENTE VARIOS'}`);
  if (sale.customer_doc_number) {
    lines.push(`DOC:     ${sale.customer_doc_number}`);
  }
  lines.push(divider("-"));

  // 3. ENCABEZADO DE PRODUCTOS
  lines.push(justifyBetween("CANT PRODUCTO", "PRECIO"));
  lines.push(divider("-"));

  // 4. DETALLE DE PRODUCTOS
  if (sale.details && Array.isArray(sale.details)) {
    sale.details.forEach((item) => {
      const qtyNum = parseFloat(item.quantity);
      const isWeight = item.unit_measure && item.unit_measure !== 'UNIDAD';
      const qtyStr = isWeight ? `${qtyNum.toFixed(3)} ${item.unit_measure}` : `${parseInt(qtyNum, 10)}x`;
      
      const lineLeft = `${qtyStr} ${item.product_name}`;
      const lineRight = `$${parseFloat(item.subtotal).toFixed(2)}`;

      if (lineLeft.length + lineRight.length + 1 > LINE_WIDTH) {
        lines.push(item.product_name.substring(0, LINE_WIDTH));
        lines.push(justifyBetween(`   ${qtyStr} @ $${parseFloat(item.unit_price).toFixed(2)}`, lineRight));
      } else {
        lines.push(justifyBetween(lineLeft, lineRight));
      }
    });
  }

  // 5. TOTALES E IMPUESTOS (IGV 18% SUNAT)
  lines.push(divider("-"));
  const subtotalGravado = parseFloat(sale.subtotal || sale.total_amount / 1.18);
  const igvAmount = parseFloat(sale.igv || sale.total_amount - subtotalGravado);

  lines.push(justifyBetween("OP. GRAVADA:", `$${subtotalGravado.toFixed(2)}`));
  lines.push(justifyBetween("IGV (18%):", `$${igvAmount.toFixed(2)}`));
  lines.push(justifyBetween("TOTAL A PAGAR:", `$${parseFloat(sale.total_amount).toFixed(2)}`));

  const isFiado = sale.payment_method === 'FIADO';

  if (isFiado) {
    lines.push(divider("="));
    lines.push(centerText("*** COMPROBANTE FIADO ***"));
    lines.push(justifyBetween("ESTADO PAGO:", "PENDIENTE"));
    lines.push(justifyBetween("FECHA LÍMITE:", sale.due_date ? sale.due_date.split('T')[0] : '15 Días'));
    if (sale.customer_total_debt) {
      lines.push(justifyBetween("DEUDA TOTAL:", `$${parseFloat(sale.customer_total_debt).toFixed(2)}`));
    }
  } else {
    lines.push(justifyBetween("RECIBIDO:", `$${parseFloat(sale.amount_paid).toFixed(2)}`));
    lines.push(justifyBetween("CAMBIO:", `$${parseFloat(sale.change_due).toFixed(2)}`));
    lines.push(justifyBetween("FORMA PAGO:", sale.payment_method || "EFECTIVO"));
  }
  
  lines.push(divider("="));

  // 6. INFORMACIÓN LEGAL SUNAT Y CÓDIGO HASH
  if (isBve || isFactura) {
    lines.push(centerText("Representación Impresa de la"));
    lines.push(centerText(docTitle));
    lines.push(centerText("Hash: " + (sale.sunat_hash ? sale.sunat_hash.substring(0, 16) : 'a1b2c3d4e5f6')));
    lines.push(centerText("Estado SUNAT: " + (sale.sunat_status || 'PENDIENTE')));
    lines.push(divider("-"));
  }

  if (isFiado) {
    lines.push(centerText("Firma del Cliente:"));
    lines.push("\n");
    lines.push(centerText("___________________________"));
    lines.push(centerText("Compromiso de Pago Aceptado"));
  } else {
    lines.push(centerText("¡Gracias por su compra!"));
    lines.push(centerText("Conserve este comprobante"));
  }
  lines.push("\n\n");

  return lines.join("\n");
}

module.exports = {
  LINE_WIDTH,
  centerText,
  justifyBetween,
  divider,
  formatTicket58mm
};
