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

/**
 * Resuelve la etiqueta corta de unidad de medida para el ticket.
 * Ej: KGM/KILOGRAMO → "KG", BOTELLA → "BOT", BOLSA → "BLS", default → "UND"
 */
function resolveUnitLabel(item) {
  if (item.is_bulk == 1 || item.is_bulk === true) return 'KG';
  const raw = String(item.unit_measure || '').toUpperCase().trim();
  if (['KG', 'KGM', 'KILOGRAMO', 'KILOGRAMOS', 'GRANEL'].includes(raw)) return 'KG';
  if (['GR', 'GRAMOS'].includes(raw)) return 'GR';
  if (['BOT', 'BOTELLA', 'BOTELLAS'].includes(raw)) return 'BOT';
  if (['BLS', 'BOLSA', 'BOLSAS'].includes(raw)) return 'BLS';
  if (['PAQ', 'PAQUETE', 'PAQUETES'].includes(raw)) return 'PAQ';
  if (['LT', 'LTR', 'LITRO', 'LITROS'].includes(raw)) return 'LT';
  if (['UNIDAD', 'UNIDADES'].includes(raw)) return 'UND';
  if (raw && raw.length <= 5) return raw; // devolver tal cual si ya es corto
  return 'UND';
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
    ? "FACTURA ELECTRONICA"
    : isBve
      ? "BOLETA DE VENTA ELEC."
      : "TICKET DE VENTA";

  // 1. ENCABEZADO FISCAL EMISOR
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
  lines.push(justifyBetween("CLIENTE:", (sale.customer_name || 'CLIENTE GENERAL').substring(0, 18)));
  if (sale.customer_doc_number) {
    lines.push(justifyBetween("DNI/RUC:", sale.customer_doc_number));
  }

  // 3. ENCABEZADO DE PRODUCTOS — CANT/UNID  x  P.UNIT       TOTAL
  lines.push(divider("-"));
  lines.push(justifyBetween("CANT/UNID  x  P.UNIT", "TOTAL"));
  lines.push(divider("-"));

  // 4. DETALLE DE PRODUCTOS
  //    Línea 1: Nombre del producto
  //    Línea 2: [qty] [UNIT] x S/.price        S/.total
  const details = sale.items || sale.details || [];
  if (Array.isArray(details) && details.length > 0) {
    details.forEach((item) => {
      const qtyNum = parseFloat(item.quantity || 1);
      const unitLabel = resolveUnitLabel(item);
      const isKgType = ['KG', 'GR'].includes(unitLabel);
      const qtyFormatted = isKgType ? qtyNum.toFixed(3) : String(parseInt(qtyNum, 10));
      const name = (item.product_name || item.name || 'Producto');
      const unitPriceVal = parseFloat(item.unit_price || item.sale_price || 0);
      const subtotalVal = parseFloat(item.subtotal || (qtyNum * unitPriceVal));

      // Línea 1: Nombre del producto (truncado al ancho de la hoja)
      lines.push(name.substring(0, LINE_WIDTH));

      // Línea 2: "2 BOT x S/.9.50         S/.19.00"
      const leftPart = `${qtyFormatted} ${unitLabel} x S/.${unitPriceVal.toFixed(2)}`;
      const rightPart = `S/.${subtotalVal.toFixed(2)}`;
      lines.push(justifyBetween(leftPart, rightPart));
    });
  } else {
    lines.push("VENTA GENERAL");
    const totalVal = parseFloat(sale.total_amount || sale.total || 0);
    lines.push(justifyBetween("1 UND x S/." + totalVal.toFixed(2), "S/." + totalVal.toFixed(2)));
  }

  // 5. TOTALES
  lines.push(divider("-"));
  const totalAmount = parseFloat(sale.total_amount || sale.total || 0);
  const subtotalBase = parseFloat(sale.subtotal || totalAmount);

  if (isBve || isFactura) {
    // Boleta / Factura → mostrar OP. GRAVADA + IGV
    const subtotalGravado = totalAmount / 1.18;
    const igvAmount = totalAmount - subtotalGravado;
    lines.push(justifyBetween("OP. GRAVADA:", `S/.${subtotalGravado.toFixed(2)}`));
    lines.push(justifyBetween("I.G.V. (18%):", `S/.${igvAmount.toFixed(2)}`));
  } else {
    // Ticket interno → solo SUBTOTAL
    lines.push(justifyBetween("SUBTOTAL:", `S/.${subtotalBase.toFixed(2)}`));
  }
  lines.push(divider("-"));
  lines.push(justifyBetween("TOTAL A PAGAR:", `S/.${totalAmount.toFixed(2)}`));
  lines.push(divider("-"));

  const isFiado = sale.payment_method === 'FIADO';

  if (isFiado) {
    lines.push(divider("="));
    lines.push(centerText("*** VENTA AL CREDITO (FIADO) ***"));
    lines.push(justifyBetween("ESTADO PAGO:", "PENDIENTE"));
    lines.push(justifyBetween("FECHA LIMITE:", sale.due_date ? String(sale.due_date).split('T')[0] : '15 Dias'));
    if (sale.customer_total_debt) {
      lines.push(justifyBetween("DEUDA TOTAL:", `S/.${parseFloat(sale.customer_total_debt).toFixed(2)}`));
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
    lines.push(justifyBetween("IMPORTE PAGADO:", `S/.${paid.toFixed(2)}`));
    if (change > 0) {
      lines.push(justifyBetween("VUELTO / CAMBIO:", `S/.${change.toFixed(2)}`));
    }
  }

  lines.push(divider("="));

  // 6. PIE LEGAL SUNAT
  if (isBve || isFactura) {
    lines.push(centerText("Representacion Impresa de la"));
    lines.push(centerText(docTitle));
    lines.push(centerText("Autorizado segun R.S. SUNAT"));
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
