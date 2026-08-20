/**
 * Formateador de Comprobantes Térmicos de 58 mm (SUNAT BVE / ESC/POS)
 * Ancho de línea estándar en 58mm: 32 Caracteres
 */

const LINE_WIDTH = 32;

function centerText(text, width = LINE_WIDTH) {
  const str = String(text || '').trim();
  if (str.length >= width) return str.substring(0, width);
  const leftPadding = Math.floor((width - str.length) / 2);
  return ' '.repeat(leftPadding) + str;
}

function justifyBetween(leftText, rightText, width = LINE_WIDTH) {
  const left = String(leftText || '');
  const right = String(rightText || '');
  const maxLeft = width - right.length - 1;
  const truncatedLeft = left.length > maxLeft ? left.substring(0, maxLeft) : left;
  const spaces = width - (truncatedLeft.length + right.length);
  return truncatedLeft + ' '.repeat(Math.max(1, spaces)) + right;
}

function divider(char = '-', width = LINE_WIDTH) {
  return char.repeat(width);
}

function formatTicket58mm(sale, customTemplate = null) {
  const lines = [];

  const tpl = customTemplate || (sale && sale.customTemplate) || {
    companyName: 'COMERCIAL BELEZA & HOGAR',
    ruc: '20601234567',
    address: 'Av. Las Flores 456, Lima',
    footer1: '¡Gracias por su preferencia!',
    footer2: 'Conserve este comprobante'
  };

  const isBve = sale.document_type === '03';
  const isFactura = sale.document_type === '01';
  const docTitle = isFactura 
    ? "FACTURA ELECTRÓNICA" 
    : isBve 
      ? "BOLETA DE VENTA ELECTRÓNICA" 
      : "TICKET DE VENTA INTERNO";

  // 1. ENCABEZADO FISCAL EMISOR (SUNAT)
  lines.push(centerText(tpl.companyName || "COMERCIAL BELEZA & HOGAR"));
  lines.push(centerText("RUC: " + (tpl.ruc || "20601234567")));
  lines.push(centerText(tpl.address || "Av. Las Flores 456, Lima"));
  lines.push(divider("="));

  // 2. DATOS DEL COMPROBANTE Y CLIENTE
  lines.push(centerText(docTitle));
  lines.push(centerText(sale.invoice_number || 'B001-00000001'));
  lines.push(divider("-"));
  
  const formattedDate = sale.created_at 
    ? new Date(sale.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

  lines.push(justifyBetween("FECHA:", formattedDate));
  lines.push(justifyBetween("CAJERO:", sale.cashier_name || 'Caja 1'));
  lines.push(justifyBetween("CLIENTE:", (sale.customer_name || 'CLIENTE GENERAL').substring(0, 20)));
  if (sale.customer_doc_number) {
    lines.push(justifyBetween("DNI/RUC:", sale.customer_doc_number));
  }
  lines.push(divider("-"));

  // 3. ENCABEZADO DE PRODUCTOS
  lines.push(justifyBetween("DESCRIPCION / CANT x P.U.", "TOTAL"));
  lines.push(divider("-"));

  // 4. DETALLE DE PRODUCTOS (Estructura ordenada de 2 líneas: Cant x P.Unit a la izquierda, Total a la derecha)
  const details = sale.items || sale.details || [];
  if (Array.isArray(details) && details.length > 0) {
    details.forEach((item) => {
      const qtyNum = parseFloat(item.quantity || 1);
      const isBulk = (item.is_bulk == 1 || item.is_bulk === true || ['KG', 'KGM', 'KILOGRAMO', 'KILOGRAMOS', 'GR'].includes(String(item.unit_measure || '').toUpperCase()));
      const qtyStr = isBulk ? `${qtyNum.toFixed(3)}kg` : `${parseInt(qtyNum, 10)}x`;
      const name = item.product_name || item.name || 'Producto';
      const unitPriceVal = parseFloat(item.unit_price || item.sale_price || 0);
      const subtotalVal = parseFloat(item.subtotal || (qtyNum * unitPriceVal));
      
      const priceLeft = `  ${qtyStr} @ S/.${unitPriceVal.toFixed(2)}`;
      const totalRight = `S/.${subtotalVal.toFixed(2)}`;

      // Línea 1: Nombre del producto
      lines.push(name.substring(0, LINE_WIDTH));
      // Línea 2: [Cantidad x Precio Unitario] a la izquierda | [Total] a la derecha
      lines.push(justifyBetween(priceLeft, totalRight));
    });
  } else {
    lines.push("VENTA GENERAL");
    lines.push(justifyBetween("  1x @ S/." + parseFloat(sale.total_amount || sale.total || 0).toFixed(2), "S/." + parseFloat(sale.total_amount || sale.total || 0).toFixed(2)));
  }

  // 5. TOTALES E IMPUESTOS (IGV 18% SUNAT)
  lines.push(divider("-"));
  const totalAmount = parseFloat(sale.total_amount || sale.total || 0);
  const subtotalGravado = parseFloat(sale.subtotal || (totalAmount / 1.18));
  const igvAmount = parseFloat(sale.igv || (totalAmount - subtotalGravado));

  lines.push(justifyBetween("OP. GRAVADA:", `S/. ${subtotalGravado.toFixed(2)}`));
  lines.push(justifyBetween("I.G.V. (18%):", `S/. ${igvAmount.toFixed(2)}`));
  lines.push(divider("-"));
  lines.push(justifyBetween("TOTAL A PAGAR:", `S/. ${totalAmount.toFixed(2)}`));

  const isFiado = sale.payment_method === 'FIADO';

  if (isFiado) {
    lines.push(divider("="));
    lines.push(centerText("*** VENTA AL CRÉDITO (FIADO) ***"));
    lines.push(justifyBetween("ESTADO PAGO:", "PENDIENTE"));
    lines.push(justifyBetween("FECHA LÍMITE:", sale.due_date ? String(sale.due_date).split('T')[0] : '15 Días'));
    if (sale.customer_total_debt) {
      lines.push(justifyBetween("DEUDA TOTAL:", `S/. ${parseFloat(sale.customer_total_debt).toFixed(2)}`));
    }
    lines.push(divider("-"));
    lines.push(centerText("Firma del Cliente:"));
    lines.push("\n");
    lines.push(centerText("___________________________"));
    lines.push(centerText("Compromiso de Pago Aceptado"));
  } else {
    lines.push(divider("="));
    const paid = parseFloat(sale.amount_paid || totalAmount);
    const change = parseFloat(sale.change_due || (paid > totalAmount ? paid - totalAmount : 0));
    lines.push(justifyBetween("FORMA DE PAGO:", sale.payment_method || "EFECTIVO"));
    lines.push(justifyBetween("IMPORTE PAGADO:", `S/. ${paid.toFixed(2)}`));
    if (change > 0) {
      lines.push(justifyBetween("VUELTO / CAMBIO:", `S/. ${change.toFixed(2)}`));
    }
  }

  lines.push(divider("="));

  // 6. INFORMACIÓN LEGAL SUNAT Y PIE DE TICKET
  if (isBve || isFactura) {
    lines.push(centerText("Representación Impresa de la"));
    lines.push(centerText(docTitle));
    lines.push(centerText("Autorizado según R.S. SUNAT"));
    lines.push(centerText("Hash: " + (sale.sunat_hash ? sale.sunat_hash.substring(0, 16) : '8f9a2b3c4d5e6f70')));
    lines.push(divider("-"));
  }

  lines.push(centerText(tpl.footer1 || "¡Gracias por su preferencia!"));
  if (tpl.footer2) {
    lines.push(centerText(tpl.footer2));
  }
  lines.push(divider("="));
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
