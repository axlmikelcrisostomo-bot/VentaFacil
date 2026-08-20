param (
    [string]$PrinterName = "POS-58-Series",
    [string]$FilePath = "",
    [int]$PaperWidthMm = 58,
    [float]$CustomFontSize = 0,
    [int]$CustomMarginLeft = -1
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

$text = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
$lines = $text -split "`r?`n"

$is80mm = ($PaperWidthMm -eq 80)
$paperWidthHundredths = if ($is80mm) { 300 } else { 200 }

# Usar tamaño personalizado o predeterminado (7.1pt estándar 58mm óptimo)
$fontSize = if ($CustomFontSize -gt 0) { $CustomFontSize } else { if ($is80mm) { 8.5 } else { 7.1 } }
$fontSizeBold = [Math]::Round($fontSize + 0.4, 1)

$leftMarginVal = if ($CustomMarginLeft -ge 0) { $CustomMarginLeft } else { 3 }

$font = New-Object System.Drawing.Font("Consolas", $fontSize, [System.Drawing.FontStyle]::Regular)
$fontBold = New-Object System.Drawing.Font("Consolas", $fontSizeBold, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $PrinterName

$lineHeight = [Math]::Ceiling($font.GetHeight() + 1.5)
$totalHeight = [Math]::Max(350, ($lines.Count * $lineHeight) + 80)

$customSize = New-Object System.Drawing.Printing.PaperSize("ThermalTicket", $paperWidthHundredths, $totalHeight)
$doc.DefaultPageSettings.PaperSize = $customSize
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.OriginAtMargins = $false

$doc.add_PrintPage({
    param($sender, $ev)
    $y = 4

    foreach ($line in $lines) {
        $trimmed = $line.TrimEnd()
        $isHeader = ($trimmed -match "^[=]+$" -or $trimmed -match "^[-]+$" -or $trimmed -match "TOTAL" -or $trimmed -match "COMERCIAL" -or $trimmed -match "BOLETA" -or $trimmed -match "FACTURA")
        $f = if ($isHeader) { $fontBold } else { $font }
        
        $ev.Graphics.DrawString($trimmed, $f, $brush, [float]$leftMarginVal, [float]$y)
        $y += $lineHeight
    }
    $ev.HasMorePages = $false
})

try {
    $doc.Print()
    Write-Output "SUCCESS_PRINTED"
} catch {
    Write-Error "Print error: $_"
    exit 1
}
