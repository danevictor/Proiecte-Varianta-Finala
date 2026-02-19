$ErrorActionPreference = "Stop"

# Configuration
$inputDir = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Rapoarte\Date_Brute"
$outputFile = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\sales_data_2024_2025.js"

Write-Host "Fetching latest data from Shopify (Last 7 days)..."
python "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\fetch_shopify_data.py" --days 7

Write-Host "Searching for CSV files in $inputDir..."
$csvFiles = Get-ChildItem -Path $inputDir -Filter "*.csv" -Recurse

if ($csvFiles.Count -eq 0) {
    Write-Error "No CSV files found!"
}


# Sort files to ensure chronological processing (Export -> Fetch)
# Assumes 'orders_export' sorts before 'orders_fetch', and timestamps in fetch are chronological.
$csvFiles = $csvFiles | Sort-Object Name

# Load and Deduplicate Data (Master Cache + Delta Strategy)
$masterFile = Join-Path $PSScriptRoot "master_orders.csv"
$latestOrderRows = @{} # Key: OrderID (#...), Value: List of Rows
$pivotDate = [DateTime]::MinValue

# 1. Load Master Cache if exists
if (Test-Path $masterFile) {
    Write-Host "Loading Master Data from $masterFile..."
    $pivotDate = (Get-Item $masterFile).LastWriteTime
    $masterData = Import-Csv -LiteralPath $masterFile
    foreach ($row in $masterData) {
        if (-not $latestOrderRows.ContainsKey($row.Name)) {
            $latestOrderRows[$row.Name] = [System.Collections.Generic.List[object]]::new()
        }
        $latestOrderRows[$row.Name].Add($row)
    }
    Write-Host "Master Data loaded ($($latestOrderRows.Count) orders). Timestamp: $pivotDate"
    

}
else {
    Write-Host "No Master Cache found. Performing full initial processing."
}


# 2. Identify Delta Files
$deltaFiles = $csvFiles | Where-Object { $_.LastWriteTime -gt $pivotDate }
Write-Host "Found $($deltaFiles.Count) new/modified files."

# 3. Process Delta Files
foreach ($file in $deltaFiles) {
    Write-Host "  Reading delta: $($file.Name)..."
    $data = Import-Csv -LiteralPath $file.FullName
    if ($data.Count -eq 0) { continue }
    
    $fileGroups = $data | Group-Object Name
    foreach ($g in $fileGroups) {
        $latestOrderRows[$g.Name] = $g.Group
    }
}



# Flatten to a single list for processing
$allRecords = [System.Collections.Generic.List[object]]::new()
foreach ($orderId in $latestOrderRows.Keys) {
    $rows = $latestOrderRows[$orderId]
    foreach ($r in $rows) {
        $allRecords.Add($r)
    }
}

# 4. Update Master Cache (Only if updates found)
if ($deltaFiles.Count -gt 0 -or -not (Test-Path $masterFile)) {
    Write-Host "Updating Master CSV Cache..."
    $allRecords | Export-Csv -Path $masterFile -NoTypeInformation -Encoding UTF8
    Write-Host "Master CSV Updated."
}

Write-Host "Total unique orders to process: $($latestOrderRows.Count)"
Write-Host "Total consolidated rows: $($allRecords.Count)"

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
$processedItems = [System.Collections.Generic.List[object]]::new()

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
    # Filter by Financial Status (Exclude Pending/Voided to match Shopify Total Sales view)
    $fStatus = $row.'Financial Status'
    if ($null -ne $fStatus) {
        $fStatus = $fStatus.ToLower()
        # Filter 'pending' (unpaid) orders
        if ($fStatus -eq 'pending') {
            continue
        }
        
    }

    if (-not $processedOrders.ContainsKey($orderId)) {
        $isCanceled = -not [string]::IsNullOrWhiteSpace($cancelledAtStr)
        
        if ($fStatus -eq 'voided') {
            # Voided orders: zero everything
            $total = 0
            $refunded = 0
            $shipping = 0
            $taxes = 0
            $discountAmount = 0
            $returns = 0
        }
        else {
            $total = Parse-Num $row.Total
            $refunded = Parse-Num $row.'Refunded Amount'
            $shipping = Parse-Num $row.Shipping
            $taxes = Parse-Num $row.Taxes
            $discountAmount = Parse-Num $row.'Discount Amount'
            $returns = Parse-Num $row.Returns
        }
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
        
        # === SHOPIFY-ALIGNED SALES FORMULA ===
        # Shopify Total Sales = Gross Sales - Discounts - Returns + Shipping + Taxes
        # 
        # Voided: everything is already zeroed above
        # Canceled (including refunded+canceled): zero all sales
        # Pending: excluded earlier (line 135)
        
        if ($isCanceled) {
            # Canceled orders (regardless of refund status): zero everything
            $netSales = 0
            $shipping = 0
            $taxes = 0
            $discountAmount = 0
            $returns = 0
        }
        else {
            # Active orders: calculate Net Sales
            if ($row.'Net Sales' -and $row.'Net Sales' -ne '' -and $row.'Net Sales' -ne '0') {
                # Use pre-calculated Net Sales from fetch_shopify_data.py (= line_item_gross - discounts)
                $netSales = Parse-Num $row.'Net Sales'
                # Subtract returns (refunded line item values)
                $netSales = $netSales - $returns
            }
            else {
                # Fallback: derive product-only value from Total
                # Shopify Total = Subtotal + Shipping + Taxes
                # So: product-only value = Total - Shipping - Taxes
                # Then subtract refunds to get net product value
                $netSales = $total - $shipping - $taxes - $refunded
            }
        }
        
        if ($netSales -lt 0) { $netSales = 0 }

        # Identify Order Type based on Tags - NEW LOGIC
        # Priority: SUB6 (saseluni) > SUB3 (treiluni/treluni) > SUB1 (appstle) > OTP
        $orderType = "OTP"
        $tagsLower = $tags.ToLower()
        
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

        # Gross Sales = line item price * qty (before discounts/returns)
        # For orders from new CSVs, we can compute from line items.
        # For the order-level, we approximate: grossSales = total - shipping - taxes + discountAmount
        # Because total = gross - discounts + shipping + taxes
        # So gross = total - shipping - taxes + discountAmount
        $grossSales = $total - $shipping - $taxes + $discountAmount
        
        # Shopify Total Sales = Net Sales + Shipping + Taxes
        # netSales is always product-only value (gross - discounts - returns/refunds)
        $totalSales = $netSales + $shipping + $taxes
        
        $orderObj = @{
            Name           = $orderId
            Email          = $email
            Date           = $dateObj
            Month          = $monthKey
            Year           = $year
            Quarter        = $qtr
            Day            = $dayKey
            IsCanceled     = $isCanceled
            Total          = $total
            Refunded       = $refunded
            Returns        = $returns
            NetSales       = $netSales
            GrossSales     = $grossSales
            TotalSales     = $totalSales
            OrderType      = $orderType  # OTP, SUB1, SUB3
            Tags           = $tags
            IsFirstOrder   = $false # Calculated later
            Shipping       = $shipping
            Taxes          = $taxes
            DiscountAmount = $discountAmount
            DiscountCode   = $discountCode
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
        
        $processedItems.Add(@{
                "Lineitem name"     = $row.'Lineitem name'
                "Lineitem quantity" = $qty
                "Line_Revenue"      = $lineRev
                Month               = $monthKey
                Year                = $year
                Quarter             = $qtr
                Day                 = $dayKey
            })
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
                # Rule: SUB3 -> 6 months (Actually 3 months + grace? No, SUB3 is quarterly. so 3 months cycle. Let's assume 4 months gap?)
                # Wait, existing code says 6 months for SUB3? "Rule: SUB3 -> 6 months". 
                # If SUB3 is every 3 months, then 6 months without order = churn seems safe (2 missed cycles).
                elseif ($lastOrderType -eq "SUB3" -and $diffMonths -eq 6) {
                    $monthlyEvents[$simKey].churn_sub3++
                    $isChurned = $true
                }
                # Rule: SUB6 -> 7 months (6 months cycle + 1 month grace)
                elseif ($lastOrderType -eq "SUB6" -and $diffMonths -eq 7) {
                    $monthlyEvents[$simKey].churn_sub6++
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
                
                # New Metrics for Report
                shipping              = 0.0
                taxes                 = 0.0
                gross_sales           = 0.0
                total_sales           = 0.0
                returns               = 0.0
                discounted_orders     = 0
                discounts_value       = 0.0
                canceled_orders       = 0
                refunded_count        = 0
                all_products          = [System.Collections.Generic.List[object]]::new()
                discount_codes        = @{}
            }
        }
        
        $g = $groups[$key]
        $g.total_orders++
        
        if (-not $ord.IsCanceled) {
            $g.valid_orders++
            $g.net_sales += $ord.NetSales
            $g.gross_sales += $ord.GrossSales
            $g.total_sales += $ord.TotalSales
            $g.shipping += $ord.Shipping
            $g.taxes += $ord.Taxes
            $g.returns += $ord.Returns
            
            if ($ord.DiscountAmount -gt 0) {
                $g.discounted_orders++
                $g.discounts_value += $ord.DiscountAmount
            }
            
            if (-not [string]::IsNullOrWhiteSpace($ord.DiscountCode)) {
                $dc = $ord.DiscountCode
                if (-not $g.discount_codes.ContainsKey($dc)) { $g.discount_codes[$dc] = 0 }
                $g.discount_codes[$dc]++
            }
            
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
            
            if ($ord.Refunded -gt 0) {
                $g.refunded_count++
            }
        }
        else {
            $g.canceled_orders++
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
    
    # --- Populate all_products from $processedItems ---
    foreach ($item in $processedItems) {
        # Check if item key exists (Month/Year/etc) matches the grouping
        if ($item.ContainsKey($periodType)) {
            # Optimize: do NOT store product list for Quarter or Year (saves ~50% size)
            if ($periodType -eq "Year" -or $periodType -eq "Quarter") { continue }

            $k = $item[$periodType]
            if ($finalResults.ContainsKey($k)) {
                $finalResults[$k].all_products.Add($item)
            }
        }
        # Fallback: if periodType is "Month", item has "Month" key.
        # But if periodType is "Year", item has "Year".
        # Logic matches because we stored Month/Year/Quarter in item object.
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



# --- Optimization: cleanup redundant fields from items to save JSON space ---
Write-Host "Optimizing JSON size..."
foreach ($item in $processedItems) {
    if ($null -ne $item) {
        $item.Remove("Year")
        $item.Remove("Quarter")
        $item.Remove("Month")
        $item.Remove("Day")
    }
}

$jsonPayload = $outputObject | ConvertTo-Json -Depth 10
$jsContent = "window.salesData = " + $jsonPayload + ";"
Set-Content -Path $outputFile -Value $jsContent -Encoding UTF8
Write-Host "Done! Full Data saved to $outputFile"

# --- DASHBOARD OPTIMIZATION (Lightweight Export) ---
Write-Host "Generating Lightweight Dashboard Data..."

function Remove-Heavy-Data($collection) {
    if ($null -eq $collection) { return }
    # Collection keys might be modified during iteration if we are not careful?
    # No, we are iterating keys and modifying values (nested objects).
    # Create a copy of the keys to iterate safely
    $keys = @($collection.Keys)
    foreach ($key in $collection.Keys) {
        if ($collection[$key].ContainsKey('all_products')) {
            $collection[$key].Remove('all_products')
        }
    }
}

Remove-Heavy-Data $outputObject.monthly
Remove-Heavy-Data $outputObject.quarterly
Remove-Heavy-Data $outputObject.annual
Remove-Heavy-Data $outputObject.daily

$dashboardJson = $outputObject | ConvertTo-Json -Depth 10
$dashboardJs = "window.salesData = " + $dashboardJson + ";"
$dashboardFile = Join-Path $PSScriptRoot "dashboard_data.js"
Set-Content -Path $dashboardFile -Value $dashboardJs -Encoding UTF8
Write-Host "Dashboard Data saved to $dashboardFile"

# Copy to Dashboard Folder
$dashboardDest = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\DASHBOARD ZITAMINE\dashboard_data.js"
Copy-Item $dashboardFile -Destination $dashboardDest -Force
Write-Host "Copied dashboard_data.js to $dashboardDest"

# Cleanup debug
# $uniqueTags = $globalTags.Keys | Sort-Object
# $uniqueTags | Out-File ...

# --- 8. GitHub Automation (Auto-Push) ---
# Try to find git, or use a standard path. 
$gitPath = "git" 
if (-not (Get-Command "git" -ErrorAction SilentlyContinue)) {
    # Try common Windows paths
    if (Test-Path "C:\Program Files\Git\cmd\git.exe") { $gitPath = "C:\Program Files\Git\cmd\git.exe" }
    elseif (Test-Path "C:\Program Files (x86)\Git\cmd\git.exe") { $gitPath = "C:\Program Files (x86)\Git\cmd\git.exe" }
    elseif (Test-Path "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe") { $gitPath = "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe" }
    else { 
        Write-Warning "Git not found in PATH or common locations. Skipping Auto-Push." 
        $gitPath = $null
    }
}

if ($gitPath) {
    Write-Host "Starting GitHub Auto-Update..."
    $repoRoot = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity"
    
    # We need to run these commands in the repo root
    Push-Location $repoRoot
    
    try {
        # Check status
        & $gitPath status -s
        
        # Add changes (Specifically the dashboard data and the HTML if modified)
        Write-Host "Adding changes..."
        & $gitPath add "Proiecte-Varianta-Finala/DASHBOARD ZITAMINE/dashboard_data.js"
        
        # Commit
        $dateStr = (Get-Date).ToString("yyyy-MM-dd HH:mm")
        Write-Host "Committing..."
        & $gitPath commit -m "Auto-update Dashboard Data: $dateStr"
        
        # Push
        Write-Host "Pushing to remote..."
        & $gitPath push
        
        Write-Host "GitHub Update Completed Successfully."
    }
    catch {
        Write-Error "GitHub Update Failed: $_"
    }
    finally {
        Pop-Location
    }
}

