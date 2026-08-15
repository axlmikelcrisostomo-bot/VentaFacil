/**
 * ScannerService - Manejo de Lectores de Código de Barras (Pistolas USB HID)
 * 
 * Las pistolas de código de barras funcionan enviando los dígitos del código
 * como si fuera una tecleada veloz terminando con la tecla ENTER (\n o \r).
 */

class ScannerService {
  /**
   * Sanitiza y limpia el código recibido por la pistola
   */
  static cleanBarcode(rawInput) {
    if (!rawInput) return '';
    // Elimina caracteres no imprimibles o saltos de línea al final
    return rawInput.toString().replace(/[\r\n\t]/g, '').trim();
  }

  /**
   * Valida si la cadena recibida cumple con el formato de código de barras común
   * (EAN-13, EAN-8, UPC-A, Code128, QR)
   */
  static isValidBarcode(barcode) {
    const cleaned = this.cleanBarcode(barcode);
    return cleaned.length >= 3 && cleaned.length <= 64;
  }
}

module.exports = ScannerService;
