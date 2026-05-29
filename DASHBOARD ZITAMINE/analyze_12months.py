import json, re

with open('dashboard_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'window\.salesData\s*=\s*(\{[\s\S]*\})\s*;?\s*$', content)
obj_str = match.group(1)
data = json.loads(obj_str)

monthly = data['monthly']
months_sorted = sorted(monthly.keys())
print("All months:", months_sorted)
print("Count:", len(months_sorted))
print()

last12 = months_sorted[-12:]
print("Last 12 months:", last12)
print()

for m in last12:
    d = monthly[m]
    print(f"=== {m} ===")
    print(f"  total_orders={d['total_orders']} valid={d.get('valid_orders','?')} canceled={d['canceled_orders']}")
    print(f"  net_sales={d['net_sales']:.0f} gross={d['gross_sales']:.0f} aov={d['aov']:.1f} cltv={d['cltv']:.1f}")
    print(f"  customers_new={d['customers_new']} customers_recurring={d['customers_recurring']} active={d['customers_active']}")
    
    sbt = d.get('sales_by_type', {})
    cbt = d.get('customers_by_type', {})
    conv = d.get('conversions', {})
    
    print(f"  OTP_sales={sbt.get('OTP',0):.0f} SUB1_sales={sbt.get('SUB1',0):.0f} SUB3_sales={sbt.get('SUB3',0):.0f} SUB6_sales={sbt.get('SUB6',0):.0f}")
    print(f"  OTP_cust={cbt.get('OTP',0)} SUB1_cust={cbt.get('SUB1',0)} SUB3_cust={cbt.get('SUB3',0)} SUB6_cust={cbt.get('SUB6',0)}")
    print(f"  otp_to_sub={conv.get('otp_to_sub',0)} sub_to_otp={conv.get('sub_to_otp',0)}")
    print(f"  churn_sub1={conv.get('churn_sub1',0)} churn_sub3={conv.get('churn_sub3',0)} churn_otp={conv.get('churn_otp',0)}")
    print(f"  sales_new={d.get('sales_new',0):.0f} sales_recurring={d.get('sales_recurring',0):.0f}")
    print(f"  discounts={d.get('discounts_value',0):.0f} disc_orders={d.get('discounted_orders',0)} refunded={d.get('refunded_count',0)}")
    print(f"  frequency={d.get('frequency',0):.2f}")
    print(f"  taxes={d.get('taxes',0):.0f} shipping={d.get('shipping',0):.0f}")
    print()

# SUMMARY CALCULATIONS
print("=" * 60)
print("SUMMARY - LAST 12 MONTHS")
print("=" * 60)

total_net = sum(monthly[m]['net_sales'] for m in last12)
total_gross = sum(monthly[m]['gross_sales'] for m in last12)
total_orders = sum(monthly[m]['total_orders'] for m in last12)
total_valid = sum(monthly[m].get('valid_orders', 0) for m in last12)
total_canceled = sum(monthly[m]['canceled_orders'] for m in last12)
avg_aov = sum(monthly[m]['aov'] for m in last12) / 12
avg_cltv = sum(monthly[m]['cltv'] for m in last12) / 12
total_new = sum(monthly[m]['customers_new'] for m in last12)
total_recurring = sum(monthly[m]['customers_recurring'] for m in last12)
total_discounts = sum(monthly[m].get('discounts_value', 0) for m in last12)
total_disc_orders = sum(monthly[m].get('discounted_orders', 0) for m in last12)

print(f"Total Net Sales: {total_net:,.0f} RON")
print(f"Total Gross Sales: {total_gross:,.0f} RON")
print(f"Total Orders: {total_orders:,}")
print(f"Total Valid Orders: {total_valid:,}")
print(f"Total Canceled: {total_canceled:,}")
print(f"Cancel Rate: {total_canceled/total_orders*100:.1f}%")
print(f"Avg AOV: {avg_aov:.1f} RON")
print(f"Avg CLTV: {avg_cltv:.1f} RON")
print(f"Total New Customers: {total_new:,}")
print(f"Total Recurring Customers: {total_recurring:,}")
print(f"Recurring %: {total_recurring/(total_new+total_recurring)*100:.1f}%")
print(f"Total Discounts: {total_discounts:,.0f} RON")
print(f"Discount Rate: {total_discounts/total_gross*100:.1f}%")
print(f"Discounted Orders: {total_disc_orders:,} ({total_disc_orders/total_orders*100:.1f}%)")
print()

# Monthly trends
print("=" * 60)
print("MONTHLY TRENDS")
print("=" * 60)
print(f"{'Month':<10} {'Net Sales':>12} {'Orders':>8} {'AOV':>8} {'CLTV':>8} {'New':>6} {'Rec':>6} {'Active':>8} {'OTP%':>6} {'SUB%':>6}")
for m in last12:
    d = monthly[m]
    sbt = d.get('sales_by_type', {})
    total_type_sales = sum(sbt.values())
    otp_pct = sbt.get('OTP', 0) / total_type_sales * 100 if total_type_sales > 0 else 0
    sub_pct = 100 - otp_pct
    print(f"{m:<10} {d['net_sales']:>12,.0f} {d['total_orders']:>8,} {d['aov']:>8.1f} {d['cltv']:>8.1f} {d['customers_new']:>6} {d['customers_recurring']:>6} {d['customers_active']:>8} {otp_pct:>5.1f}% {sub_pct:>5.1f}%")

print()
print("=" * 60)
print("COHORT ANALYSIS (Sales by Type)")
print("=" * 60)
for m in last12:
    d = monthly[m]
    sbt = d.get('sales_by_type', {})
    total_s = sum(sbt.values())
    print(f"{m}: OTP={sbt.get('OTP',0):>10,.0f} ({sbt.get('OTP',0)/total_s*100:>5.1f}%) | SUB1={sbt.get('SUB1',0):>10,.0f} ({sbt.get('SUB1',0)/total_s*100:>5.1f}%) | SUB3={sbt.get('SUB3',0):>10,.0f} ({sbt.get('SUB3',0)/total_s*100:>5.1f}%)")

print()
print("=" * 60)
print("CHURN & CONVERSION")  
print("=" * 60)
for m in last12:
    d = monthly[m]
    conv = d.get('conversions', {})
    total_churn = conv.get('churn_sub1',0) + conv.get('churn_sub3',0) + conv.get('churn_otp',0) + conv.get('churn_sub6',0)
    print(f"{m}: otp_to_sub={conv.get('otp_to_sub',0):>4} | sub_to_otp={conv.get('sub_to_otp',0):>3} | churn_total={total_churn:>4} (sub1={conv.get('churn_sub1',0):>3} sub3={conv.get('churn_sub3',0):>3} otp={conv.get('churn_otp',0):>3})")

# MoM growth
print()
print("=" * 60)
print("MoM GROWTH (Net Sales)")
print("=" * 60)
for i in range(1, len(last12)):
    prev_m = last12[i-1]
    curr_m = last12[i]
    prev_val = monthly[prev_m]['net_sales']
    curr_val = monthly[curr_m]['net_sales']
    growth = (curr_val - prev_val) / prev_val * 100 if prev_val > 0 else 0
    print(f"{prev_m} -> {curr_m}: {growth:>+7.1f}% ({prev_val:>12,.0f} -> {curr_val:>12,.0f})")

# YoY comparison if we have data 
print()
print("=" * 60)
print("YoY COMPARISON (if available)")
print("=" * 60)
for m in last12:
    year = int(m[:4])
    month_num = m[5:]
    prev_year_key = f"{year-1}-{month_num}"
    if prev_year_key in monthly:
        curr = monthly[m]['net_sales']
        prev = monthly[prev_year_key]['net_sales']
        growth = (curr - prev) / prev * 100 if prev > 0 else 0
        print(f"{prev_year_key} vs {m}: {growth:>+7.1f}% ({prev:>12,.0f} vs {curr:>12,.0f})")

# Best/Worst months
print()
print("=" * 60)
print("BEST & WORST MONTHS (Net Sales)")
print("=" * 60)
sales_by_month = [(m, monthly[m]['net_sales']) for m in last12]
sales_by_month.sort(key=lambda x: x[1], reverse=True)
print("TOP 3:")
for m, s in sales_by_month[:3]:
    print(f"  {m}: {s:>12,.0f} RON")
print("BOTTOM 3:")
for m, s in sales_by_month[-3:]:
    print(f"  {m}: {s:>12,.0f} RON")

# New vs Recurring revenue
print()
print("=" * 60)
print("NEW vs RECURRING REVENUE")
print("=" * 60)
total_new_rev = sum(monthly[m].get('sales_new', 0) for m in last12)
total_rec_rev = sum(monthly[m].get('sales_recurring', 0) for m in last12)
print(f"Total New Revenue: {total_new_rev:>12,.0f} RON ({total_new_rev/(total_new_rev+total_rec_rev)*100:.1f}%)")
print(f"Total Recurring Revenue: {total_rec_rev:>12,.0f} RON ({total_rec_rev/(total_new_rev+total_rec_rev)*100:.1f}%)")
print()
for m in last12:
    d = monthly[m]
    new_r = d.get('sales_new', 0)
    rec_r = d.get('sales_recurring', 0)
    total_r = new_r + rec_r
    rec_pct = rec_r / total_r * 100 if total_r > 0 else 0
    print(f"{m}: New={new_r:>10,.0f} Rec={rec_r:>10,.0f} Rec%={rec_pct:>5.1f}%")
