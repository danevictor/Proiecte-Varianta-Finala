$ErrorActionPreference = "Stop"

# Configuration
$inputDir = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Rapoarte\Date_Brute"
$outputFile = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte Varianta Finala\Raport_Vanzari_2024_2026\sales_data_2024_2025.js"

Write-Host "Searching for CSV files in $inputDir..."
$csvFiles = Get-ChildItem -Path $inputDir -Filter "*.csv" -Recurse

if ($csvFiles.Count -eq 0) {
    Write-Error "No CSV files found!"
}

$allRecords = @()

foreach ($file in $csvFiles) {
    Write-Host "Reading $($file.Name)..."
    $data = Import-Csv -LiteralPath $file.FullName
    $allRecords += $data
}

Write-Host "Total raw rows: $($allRecords.Count)"

# Helper to parse dates safely
function Parse-DateStr($d) {
    if ([string]::IsNullOrWhiteSpace($d)) { return $null }
    try {
        $clean = $d -split '\+' | Select-Object -First 1
        return [datetime]::Parse($clean)
    }
    catch {
        return $null
    }
}

# Helper to parse numbers
function Parse-Num($n) {
    if ([string]::IsNullOrWhiteSpace($n)) { return 0 }
    return [double]$n
}

$globalTags = @{}

# Process Data in memory
$processedOrders = @{} # Key: Order Name (Id)
$processedItems = @()

# Customer History Storage
$customerHistory = @{} # Key: Email, Value: List of Order Objects

# Global Event Counters (Grouped by Month)
$monthlyEvents = @{} 

foreach ($row in $allRecords) {
    $orderId = $row.Name
    $email = $row.Email
    $createdAtStr = $row.'Created at'
    $cancelledAtStr = $row.'Cancelled at'
    
    # Dates
    $dateObj = Parse-DateStr $createdAtStr
    if ($null -eq $dateObj) { continue }
    
    $monthKey = $dateObj.ToString("yyyy-MM")
    $year = $dateObj.ToString("yyyy")
    $qtr = "Q" + [math]::Ceiling($dateObj.Month / 3) + "-" + $year
    $dayKey = $dateObj.ToString("yyyy-MM-dd")
    
    # --- Order Level Data ---
    if (-not $processedOrders.ContainsKey($orderId)) {
        $isCanceled = -not [string]::IsNullOrWhiteSpace($cancelledAtStr)
        
        $total = Parse-Num $row.Total
        $refunded = Parse-Num $row.'Refunded Amount'
        $shipping = Parse-Num $row.Shipping
        $taxes = Parse-Num $row.Taxes
        $discountAmount = Parse-Num $row.'Discount Amount'
        $discountCode = $row.'Discount Code'
        $tags = $row.Tags
        
        # Collect Unique Tags for Debugging
        if ($tags) {
            $tList = $tags -split ','
            foreach ($t in $tList) {
                $uniqueT = $t.Trim()
                if (-not [string]::IsNullOrWhiteSpace($uniqueT)) {
                    $globalTags[$uniqueT] = $true
                }
            }
        }
        
        # Net Sales Logic
        $netSales = 0
        if (-not $isCanceled) {
            $netSales = $total - $refunded
        }

        # Identify Order Type based on Tags - NEW LOGIC
        # Priority: SUB6 (saseluni) > SUB3 (treiluni/treluni) > SUB1 (appstle) > OTP
        $orderType = "OTP"
        $tagsLower = $tags.ToLower()
        
        if ($tagsLower -match "saseluni") {
            $orderType = "SUB6"
        }
        elseif ($tagsLower -match "treiluni" -or $tagsLower -match "treluni") {
            $orderType = "SUB3"
        }
        elseif ($tagsLower -match "appstle_subscription") {
            $orderType = "SUB1"
        }
        elseif ($tagsLower -match "subscription") {
            # Fallback for generic 'subscription' tag if 'appstle' is missing but clearly sub
            $orderType = "SUB1"
        }
        
        # Debug Helper (Optional, commented out for speed)
        # if ($processedOrders.Count -lt 5) { Write-Host "DEBUG: $tags -> $orderType" }

        
        # DEBUG: Log first few non-OTP tags to verify
        if ($orderType -ne "OTP" -and $processedOrders.Count -lt 50) {
            # Write-Host "DEBUG: Found $orderType with Tags: $tags"
        }
        if ($processedOrders.Count -lt 5) {
            Write-Host "DEBUG RAW TAGS: '$tags' -> Classified as: $orderType"
        }
        
        # Determine if New or Recurring Customer
        # Need to know if this is the customer's first order.
        # Since we are processing linearly but the input might not be sorted, we should rely on a pre-scan or post-processing.
        # Optimization: We process rows. If we build Customer History on the fly, we know if keys exist?
        # NO, input rows are not guaranteed to be chronological across files.
        # We need to defer New/Recurring classification until AFTER we have all orders for a customer.
        # See below loop.

        # Order Object
        $orderObj = @{
            Name         = $orderId
            Email        = $email
            Date         = $dateObj
            Month        = $monthKey
            Year         = $year
            Quarter      = $qtr
            Day          = $dayKey
            IsCanceled   = $isCanceled
            Total        = $total
            Refunded     = $refunded
            NetSales     = $netSales
            OrderType    = $orderType  # OTP, SUB1, SUB3
            Tags         = $tags
            IsFirstOrder = $false # Calculated later
        }
        
        $processedOrders[$orderId] = $orderObj

        # Add to Customer History
        if (-not $isCanceled -and -not [string]::IsNullOrWhiteSpace($email)) {
            if (-not $customerHistory.ContainsKey($email)) {
                $customerHistory[$email] = @()
            }
            $customerHistory[$email] += $orderObj
        }
    }
    
    # --- Item Level Data ---
    if ([string]::IsNullOrWhiteSpace($cancelledAtStr)) {
        $qty = Parse-Num $row.'Lineitem quantity'
        $price = Parse-Num $row.'Lineitem price'
        $lineRev = $qty * $price 
        
        $processedItems += @{
            Name    = $row.'Lineitem name'
            Qty     = $qty
            Revenue = $lineRev
            Month   = $monthKey
            Year    = $year
            Quarter = $qtr
            Day     = $dayKey
        }
    }
}

Write-Host "Unique Orders: $($processedOrders.Count)"
Write-Host "Unique Customers: $($customerHistory.Count)"

# --- Post-Process: Determine New vs Recurring ---
Write-Host "Classifying New vs Recurring..."
foreach ($email in $customerHistory.Keys) {
    # Sort by Date ASC
    $customerOrders = $customerHistory[$email] | Sort-Object Date
    
    # First one is New
    $isFirst = $true
    foreach ($ord in $customerOrders) {
        if ($isFirst) {
            $ord.IsFirstOrder = $true
            $isFirst = $false
        }
        else {
            $ord.IsFirstOrder = $false
        }
    }
}

# --- Customer Journey Simulation (Transitions & Churn) ---
Write-Host "Simulating Customer Journeys..."

$simulationEnd = Get-Date

foreach ($email in $customerHistory.Keys) {
    # Re-fetch sorted orders (pointers modified above)
    $orders = $customerHistory[$email] | Sort-Object Date
    if ($orders.Count -eq 0) { continue }
    
    $firstOrderDate = $orders[0].Date
    if ($null -eq $firstOrderDate) { continue }
    
    # Simulation cursors
    $currentSimMonth = $firstOrderDate
    # Normalize to 1st of month
    $currentSimMonth = Get-Date -Year $currentSimMonth.Year -Month $currentSimMonth.Month -Day 1 -Hour 0 -Minute 0 -Second 0
    
    $lastOrderType = "None"
    $lastOrderDate = $null
    
    # Map months to orders
    $monthHasOrder = @{}
    foreach ($ord in $orders) {
        $mKey = $ord.Date.ToString("yyyy-MM")
        if (-not $monthHasOrder.ContainsKey($mKey)) { $monthHasOrder[$mKey] = @() }
        $monthHasOrder[$mKey] += $ord
    }
    
    $isChurned = $false
    
    while ($currentSimMonth -lt $simulationEnd) {
        $simKey = $currentSimMonth.ToString("yyyy-MM")
        
        # init containers
        if (-not $monthlyEvents.ContainsKey($simKey)) {
            $monthlyEvents[$simKey] = @{
                otp_to_sub   = 0
                sub1_to_sub3 = 0
                sub_to_otp   = 0
                sub3_to_sub1 = 0
                churn_otp    = 0
                churn_sub1   = 0
                churn_sub3   = 0
                churn_sub6   = 0
            }
        }
        
        if ($monthHasOrder.ContainsKey($simKey)) {
            $monthsOrders = $monthHasOrder[$simKey]
            foreach ($ord in $monthsOrders) {
                $thisType = $ord.OrderType
                
                # Conversion: OTP -> SUB1/SUB3
                if (($lastOrderType -eq "None" -or $lastOrderType -eq "OTP") -and ($thisType -match "SUB")) {
                    $monthlyEvents[$simKey].otp_to_sub++
                }
                # Upgrade: SUB1 -> SUB3
                elseif ($lastOrderType -eq "SUB1" -and $thisType -eq "SUB3") {
                    $monthlyEvents[$simKey].sub1_to_sub3++
                }
                # Downgrade: SUB -> OTP
                elseif (($lastOrderType -match "SUB") -and $thisType -eq "OTP") {
                    $monthlyEvents[$simKey].sub_to_otp++
                }
                # Downgrade: SUB3 -> SUB1
                elseif ($lastOrderType -eq "SUB3" -and $thisType -eq "SUB1") {
                    $monthlyEvents[$simKey].sub3_to_sub1++
                }
                
                $lastOrderType = $thisType
                $lastOrderDate = $ord.Date
                $isChurned = $false
            }
        }
        else {
            if (-not $isChurned -and $lastOrderDate -ne $null) {
                # Strict month diff
                $diffMonths = (($currentSimMonth.Year - $lastOrderDate.Year) * 12) + $currentSimMonth.Month - $lastOrderDate.Month
                
                # Rule: OTP/SUB1 -> 3 months
                if (($lastOrderType -eq "OTP" -or $lastOrderType -eq "SUB1") -and $diffMonths -eq 3) {
                    if ($lastOrderType -eq "OTP") { $monthlyEvents[$simKey].churn_otp++ }
                    else { $monthlyEvents[$simKey].churn_sub1++ }
                    $isChurned = $true
                }
                # Rule: SUB3 -> 6 months
                elseif ($lastOrderType -eq "SUB3" -and $diffMonths -eq 6) {
                    $monthlyEvents[$simKey].churn_sub3++
                    $isChurned = $true
                }
            }
        }
        $currentSimMonth = $currentSimMonth.AddMonths(1)
    }
}

# Aggregation Function (Metrics + Cohorts)
function Aggregate-Metrics($periodType) {
    $groups = @{}
    
    # We need to process chronologically for CLTV running totals if we were doing it line-by-line, 
    # but here we aggregate buckets first.
    
    foreach ($oid in $processedOrders.Keys) {
        $ord = $processedOrders[$oid]
        $key = $ord[$periodType]
        
        if (-not $groups.ContainsKey($key)) {
            $groups[$key] = @{
                period                = $key
                total_orders          = 0
                valid_orders          = 0
                
                net_sales             = 0.0
                aov                   = 0.0
                
                # Breakdowns
                sales_by_type         = @{ OTP = 0.0; SUB1 = 0.0; SUB3 = 0.0; SUB6 = 0.0 }
                sales_new             = 0.0
                sales_recurring       = 0.0
                
                customers_new         = 0
                
                # Sets for unique counting
                customers_active_set  = @{} 
                customers_by_type_set = @{ OTP = @{}; SUB1 = @{}; SUB3 = @{}; SUB6 = @{} }
            }
        }
        
        $g = $groups[$key]
        $g.total_orders++
        
        if (-not $ord.IsCanceled) {
            $g.valid_orders++
            $g.net_sales += $ord.NetSales
            
            # Type Breakdown (Sales)
            $t = $ord.OrderType
            if (-not $g.sales_by_type.ContainsKey($t)) { $g.sales_by_type[$t] = 0.0 }
            $g.sales_by_type[$t] += $ord.NetSales
            
            # Active Customer Set (Total)
            if (-not [string]::IsNullOrWhiteSpace($ord.Email)) {
                $g.customers_active_set[$ord.Email] = $true
                 
                # Type Breakdown (Customers)
                if (-not $g.customers_by_type_set.ContainsKey($t)) { $g.customers_by_type_set[$t] = @{} }
                $g.customers_by_type_set[$t][$ord.Email] = $true
            }

            # New vs Recurring Breakdown (Sales)
            if ($ord.IsFirstOrder) {
                $g.sales_new += $ord.NetSales
                $g.customers_new++
            }
            else {
                $g.sales_recurring += $ord.NetSales
            }
        }
    }
    
    # Post-Aggregate Calculations (CLTV, Frequency, Lists)
    $sortedKeys = $groups.Keys | Sort-Object
    
    $cumSales = 0.0
    $cumCustomers = @{}
    
    $finalResults = @{}
    
    foreach ($key in $sortedKeys) {
        $g = $groups[$key]
        
        # AOV
        if ($g.valid_orders -gt 0) { $g.aov = $g.net_sales / $g.valid_orders }
        
        # Customer Counts
        $activeCount = $g.customers_active_set.Count
        $g.customers_active = $activeCount
        $g.Remove('customers_active_set') # cleanup to keep JSON small
        
        # Count Customers by Type
        $g.customers_by_type = @{ OTP = 0; SUB1 = 0; SUB3 = 0; SUB6 = 0 }
        foreach ($t in $g.customers_by_type_set.Keys) {
            $g.customers_by_type[$t] = $g.customers_by_type_set[$t].Count
        }
        $g.Remove('customers_by_type_set') # cleanup

        # Recurring Customers = Active - New
        $g.customers_recurring = $activeCount - $g.customers_new
        if ($g.customers_recurring -lt 0) { $g.customers_recurring = 0 }

        # Cumulative Metrics (CLTV / Frequency)
        $cumSales += $g.net_sales
        
        if (-not $cumCustomers.ContainsKey('count')) { $cumCustomers['count'] = 0 }
        $cumCustomers['count'] += $g.customers_new
        
        $totalUniqueSoFar = $cumCustomers['count']
        
        # CLTV
        if ($totalUniqueSoFar -gt 0) {
            $g.cltv = $cumSales / $totalUniqueSoFar
        }
        else {
            $g.cltv = 0
        }
        
        # Cumulative Orders Logic for Frequency
        if (-not $cumCustomers.ContainsKey('orders')) { $cumCustomers['orders'] = 0 }
        $cumCustomers['orders'] += $g.valid_orders
        
        if ($totalUniqueSoFar -gt 0) {
            $g.frequency = $cumCustomers['orders'] / $totalUniqueSoFar
        }
        else {
            $g.frequency = 0
        }

        # Conversion Data Integration
        if ($periodType -eq "Month" -and $monthlyEvents.ContainsKey($key)) {
            $g.conversions = $monthlyEvents[$key]
        }
        
        $finalResults[$key] = $g
    }
    
    return $finalResults
}

Write-Host "Aggregating Metrics..."
$monthlyStats = Aggregate-Metrics "Month"
$quarterlyStats = Aggregate-Metrics "Quarter"
$annualStats = Aggregate-Metrics "Year"
$dailyStats = Aggregate-Metrics "Day"

$outputObject = @{
    generated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    lastUpdated  = (Get-Date).ToString("dd.MM.yyyy HH:mm")
    monthly      = $monthlyStats
    quarterly    = $quarterlyStats
    annual       = $annualStats
    daily        = $dailyStats
}


$jsonPayload = $outputObject | ConvertTo-Json -Depth 10
$jsContent = "window.salesData = " + $jsonPayload + ";"
Set-Content -Path $outputFile -Value $jsContent -Encoding UTF8

Write-Host "Done! Data saved to $outputFile"

# DEBUG: Export Unique Tags
$uniqueTags = $globalTags.Keys | Sort-Object
$uniqueTags | Out-File "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte Varianta Finala\DASHBOARD ZITAMINE\unique_tags.txt"
Write-Host "Debug: Exported $($uniqueTags.Count) unique tags to unique_tags.txt"
