
$masterPath = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\master_orders.csv"
Write-Host "Loading master data..."
$data = Import-Csv $masterPath

$targetOrder = $data | Where-Object { $_.Name -eq '#34727' }

if ($targetOrder) {
    Write-Host "Found Order #34727"
    Write-Host "Raw Tags: '$($targetOrder.Tags)'"
    
    $tagsLower = $targetOrder.Tags.ToLower()
    $orderType = "OTP"
    
    if ($tagsLower -match "saseluni") {
        $orderType = "SUB6"
        Write-Host "MATCHED saseluni"
    }
    elseif ($tagsLower -match "treiluni" -or $tagsLower -match "treluni") {
        $orderType = "SUB3"
        Write-Host "MATCHED treiluni"
    }
    elseif ($tagsLower -match "appstle_subscription") {
        $orderType = "SUB1"
        Write-Host "MATCHED appstle"
    }
    elseif ($tagsLower -match "subscription") {
        $orderType = "SUB1"
        Write-Host "MATCHED generic subscription"
    }
    
    Write-Host "Resolved OrderType: $orderType"
}
else {
    Write-Host "Order not found in CSV object model."
}
