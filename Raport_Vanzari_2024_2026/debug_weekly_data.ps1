
$jsonContent = Get-Content "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\sales_data_2024_2025.js" -Raw
# Remove "window.salesData = " and ";"
$jsonString = $jsonContent -replace '^window\.salesData\s*=\s*', '' -replace ';\s*$', ''
$data = $jsonString | ConvertFrom-Json

$startDate = Get-Date "2026-02-09"
$endDate = Get-Date "2026-02-15"

$totalGross = 0
$totalShipping = 0
$totalTaxes = 0
$totalNet = 0

Write-Host "--- Daily Breakdown (Feb 9 - Feb 15) ---"
foreach ($day in $data.daily.PSObject.Properties) {
    $dateStr = $day.Name
    try {
        $dateObj = Get-Date $dateStr
        if ($dateObj -ge $startDate -and $dateObj -le $endDate) {
            $d = $day.Value
            $gross = $d.gross_sales
            $shipping = $d.shipping
            $taxes = $d.taxes
            $net = $d.net_sales
            
            $totalGross += $gross
            $totalShipping += $shipping
            $totalTaxes += $taxes
            $totalNet += $net
            
            Write-Host "$dateStr : Gross=$gross | Net=$net | Ship=$shipping | Tax=$taxes"
        }
    }
    catch {}
}

Write-Host "-------------------------------------------"
Write-Host "TOTAL WEEKLY GROSS    : $totalGross RON"
Write-Host "TOTAL WEEKLY SHIPPING : $totalShipping RON"
Write-Host "TOTAL WEEKLY TAXES    : $totalTaxes RON"
Write-Host "TOTAL WEEKLY NET      : $totalNet RON"
Write-Host "CALCULATED TOTAL (Gross + Ship + Tax?): $($totalGross + $totalShipping + $totalTaxes)"
