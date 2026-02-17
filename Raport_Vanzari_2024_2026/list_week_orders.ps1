$csvPath = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Rapoarte\Date_Brute\orders_fetch_2026-02-17_1048.csv"
$data = Import-Csv -LiteralPath $csvPath

$startDate = [datetime]::Parse("2026-02-09")
$endDate = [datetime]::Parse("2026-02-15").AddDays(1).AddSeconds(-1)
# $endDate is Feb 15 23:59:59

Write-Host "Orders from Feb 9 to Feb 15, 2026"
Write-Host "------------------------------------------------------------------------------------------------"
Write-Host ("{0,-10} {1,-20} {2,-15} {3,-10} {4,-15} {5}" -f "Order", "Date", "Status", "Total", "Mark", "Cancelled At")
Write-Host "------------------------------------------------------------------------------------------------"

$totalSum = 0
$count = 0
$canceledCount = 0

# Group by Order Name to deduplicate line items
$grouped = $data | Group-Object Name

# Sort by Date (need to parse first)
# But here we iterate groups. Let's just iterate and print if in range.
# We can collect them into a custom list and sort.

$reportList = [System.Collections.Generic.List[object]]::new()

foreach ($g in $grouped) {
    $rows = $g.Group
    $firstRow = $rows[0]
    
    $d = $firstRow.'Created at' -split '\+' | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($d)) { continue }
    try {
        $date = [datetime]::Parse($d)
    }
    catch { continue }
    
    # Filter Date Range
    if ($date -ge $startDate -and $date -le $endDate) {
        $status = $firstRow.'Financial Status'
        $fulfill = $firstRow.'Fulfillment Status'
        $cancelledAtStr = $firstRow.'Cancelled at'
        $total = [math]::Round([decimal]$firstRow.Total, 2)
        
        $isCanceled = -not [string]::IsNullOrWhiteSpace($cancelledAtStr)

        if ($status -eq 'pending') { continue } # Exclude Pending completely as per user stats

        $mark = ""
        if ($isCanceled) { $mark = "CANCELED" }
        if ($isCanceled -and $status -eq 'voided') { $mark = "VOIDED" }
        if ($status -eq 'voided') { $mark = "VOIDED" } # Catch all voided
        
        # Sales Logic: Strict 0 for Canceled/Voided
        $salesContrib = $total
        if ($isCanceled -or $status -eq 'voided' -or $status -eq 'refunded') { 
            $salesContrib = 0 
        }

        $reportList.Add(@{
                Name        = $g.Name
                Date        = $date
                Status      = $status
                Total       = $total
                Sales       = $salesContrib
                Mark        = $mark
                CancelledAt = $cancelledAtStr
            })
    }
}

# Sort by Date
$reportList = $reportList | Sort-Object Date

foreach ($item in $reportList) {
    Write-Host ("{0,-10} {1,-20} {2,-15} {3,-10} {4,-15} {5}" -f $item.Name, $item.Date.ToString("yyyy-MM-dd HH:mm"), $item.Status, $item.Total, $item.Mark, $item.CancelledAt)
    
    if ($item.Mark -eq "CANCELED" -or $item.Mark -eq "VOIDED") {
        $canceledCount++
    }
    else {
        $totalSum += $item.Sales
        $count++
    }
}

Write-Host "------------------------------------------------------------------------------------------------"
Write-Host "Valid Orders: $count"
Write-Host "Canceled: $canceledCount"
Write-Host "Total Sales: $totalSum"
