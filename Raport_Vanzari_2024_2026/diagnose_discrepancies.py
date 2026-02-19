"""
Diagnostic script to analyze sales discrepancies between Shopify dashboard and our report.

Two periods analyzed:
1. Week 09.02.2026 - 15.02.2026 (Shopify: 21822, Report: 23674)
2. Current week 16.02.2026 - 18.02.2026 (Shopify: 20378, Report: 13208)
"""

import requests
import json
from datetime import datetime

SHOPIFY_STORE_URL = "zitamine-ro.myshopify.com"
API_VERSION = "2024-10"
SHOPIFY_ACCESS_TOKEN = "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"

def get_headers():
    return {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }

def fetch_orders(start_date, end_date):
    url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/orders.json"
    params = {
        "status": "any",
        "created_at_min": start_date,
        "created_at_max": end_date,
        "limit": 250,
        "fields": "id,name,created_at,total_price,subtotal_price,total_tax,total_discounts,total_shipping_price_set,financial_status,fulfillment_status,refunds,cancelled_at,test,tags,shipping_lines"
    }
    
    orders = []
    headers = get_headers()
    
    while url:
        resp = requests.get(url, headers=headers, params=params)
        data = resp.json()
        orders.extend(data.get("orders", []))
        
        link = resp.headers.get("Link")
        url = None
        params = {}
        if link:
            for l in link.split(", "):
                if 'rel="next"' in l:
                    url = l.split("; ")[0].strip("<>")
    
    return orders

def analyze_week(label, start, end, shopify_target, report_target):
    print(f"\n{'='*80}")
    print(f"  ANALIZA: {label}")
    print(f"  Perioada: {start} -> {end}")
    print(f"{'='*80}")
    
    orders = fetch_orders(start, end)
    print(f"\nTotal comenzi gasite (inclusiv test): {len(orders)}")
    
    # Filter out test orders
    orders = [o for o in orders if not o.get("test")]
    print(f"Comenzi reale (fara test): {len(orders)}")
    
    # --- SHOPIFY TOTAL SALES CALCULATION ---
    # Shopify Total Sales = Net Sales + Shipping + Taxes + Duties
    # Net Sales = Gross Sales - Discounts - Returns
    # Gross Sales = Subtotal (price * qty before discounts)
    
    # --- OUR REPORT CALCULATION ---
    # NetSales = Total - Refunded (if no 'Net Sales' column)
    # Then: if canceled/voided/refunded => 0
    # Then: if < 0 => 0
    # Excludes: pending orders
    
    status_breakdown = {}
    
    sum_total_price = 0.0         # Shopify total_price field
    sum_subtotal_price = 0.0      # Shopify subtotal_price (products only, after discounts)
    sum_tax = 0.0
    sum_shipping = 0.0
    sum_discounts = 0.0
    sum_refunds = 0.0
    
    # Our report's calculation
    our_net_sales = 0.0
    our_gross_sales = 0.0
    
    canceled_orders = []
    voided_orders = []
    refunded_orders = []
    pending_orders = []
    
    for o in orders:
        status = o.get("financial_status", "unknown")
        total_price = float(o.get("total_price", 0))
        subtotal = float(o.get("subtotal_price", 0))
        tax = float(o.get("total_tax", 0))
        discounts = float(o.get("total_discounts", 0))
        cancelled_at = o.get("cancelled_at")
        
        # Shipping
        shipping = 0.0
        for sl in o.get("shipping_lines", []):
            shipping += float(sl.get("price", 0))
        
        # Refunds
        refund_amount = 0.0
        for r in o.get("refunds", []):
            for t in r.get("transactions", []):
                if t.get("kind") == "refund" and t.get("status") == "success":
                    refund_amount += float(t.get("amount", 0))
        
        # Status tracking
        if status not in status_breakdown:
            status_breakdown[status] = {"count": 0, "total": 0.0, "shipping": 0.0, "tax": 0.0, "refunds": 0.0}
        status_breakdown[status]["count"] += 1
        status_breakdown[status]["total"] += total_price
        status_breakdown[status]["shipping"] += shipping
        status_breakdown[status]["tax"] += tax
        status_breakdown[status]["refunds"] += refund_amount
        
        is_canceled = cancelled_at is not None and cancelled_at != ""
        
        # Track special orders
        if status == "pending":
            pending_orders.append({"name": o["name"], "total": total_price})
        if status == "voided":
            voided_orders.append({"name": o["name"], "total": total_price})
        if status == "refunded":
            refunded_orders.append({"name": o["name"], "total": total_price, "refund": refund_amount})
        if is_canceled and status != "voided":
            canceled_orders.append({"name": o["name"], "total": total_price, "status": status})
        
        # Shopify sums (ALL orders, including pending)
        sum_total_price += total_price
        sum_subtotal_price += subtotal
        sum_tax += tax
        sum_shipping += shipping
        sum_discounts += discounts
        sum_refunds += refund_amount
        
        # --- OUR REPORT's logic ---
        # Skip pending
        if status == "pending":
            continue
        
        # Voided -> zero
        if status == "voided":
            continue
        
        # Calculate net sales
        order_net = total_price - refund_amount
        
        # If canceled or refunded -> zero
        if is_canceled or status == "refunded":
            order_net = 0
        
        # Floor at 0
        if order_net < 0:
            order_net = 0
        
        our_net_sales += order_net
        
        # Gross sales in our report = total - shipping - taxes
        if not is_canceled and status not in ("voided", "refunded"):
            our_gross_sales += (total_price - shipping - tax)
    
    # === PRINT RESULTS ===
    print(f"\n--- Status Breakdown ---")
    for st, data in sorted(status_breakdown.items()):
        print(f"  {st}: {data['count']} orders, total={data['total']:.2f}, shipping={data['shipping']:.2f}, tax={data['tax']:.2f}, refunds={data['refunds']:.2f}")
    
    print(f"\n--- Shopify Sums (All Orders) ---")
    print(f"  Sum total_price:    {sum_total_price:.2f}")
    print(f"  Sum subtotal_price: {sum_subtotal_price:.2f}")
    print(f"  Sum taxes:          {sum_tax:.2f}")
    print(f"  Sum shipping:       {sum_shipping:.2f}")
    print(f"  Sum discounts:      {sum_discounts:.2f}")
    print(f"  Sum refunds:        {sum_refunds:.2f}")
    
    # Shopify "Total Sales" formula
    shopify_total_sales = sum_total_price - sum_refunds
    shopify_net_sales_only = sum_subtotal_price - sum_discounts - sum_refunds
    
    print(f"\n--- Shopify 'Total Sales Over Time' Estimates ---")
    print(f"  total_price - refunds = {shopify_total_sales:.2f}")
    print(f"  (subtotal - discounts - refunds) + shipping + taxes = {shopify_net_sales_only + sum_shipping + sum_tax:.2f}")
    print(f"  Shopify Dashboard Target: {shopify_target}")
    
    print(f"\n--- Our Report Calculation ---")
    print(f"  Net Sales (our logic): {our_net_sales:.2f}")
    print(f"  Gross Sales (our logic): {our_gross_sales:.2f}")
    print(f"  Report Target: {report_target}")
    
    print(f"\n--- Special Orders ---")
    if pending_orders:
        print(f"  PENDING ({len(pending_orders)}):")
        for p in pending_orders:
            print(f"    {p['name']}: {p['total']:.2f} RON")
        print(f"    Total pending: {sum(p['total'] for p in pending_orders):.2f}")
    
    if voided_orders:
        print(f"  VOIDED ({len(voided_orders)}):")
        for v in voided_orders:
            print(f"    {v['name']}: {v['total']:.2f} RON")
    
    if canceled_orders:
        print(f"  CANCELED (non-voided) ({len(canceled_orders)}):")
        for c in canceled_orders:
            print(f"    {c['name']}: {c['total']:.2f} (status: {c['status']})")
    
    if refunded_orders:
        print(f"  REFUNDED ({len(refunded_orders)}):")
        for r in refunded_orders:
            print(f"    {r['name']}: total={r['total']:.2f}, refund={r['refund']:.2f}")
    
    # DISCREPANCY ANALYSIS
    print(f"\n--- DISCREPANCY ANALYSIS ---")
    
    diff1 = report_target - shopify_target
    print(f"  Report ({report_target}) vs Shopify ({shopify_target}): diferenta = {diff1:+.0f}")
    
    # Check if pending orders explain ANY difference
    pending_total = sum(p['total'] for p in pending_orders) if pending_orders else 0
    print(f"  Pending orders total: {pending_total:.2f}")
    
    # Check difference between total_price sum and Shopify dashboard
    print(f"  Sum total_price ({sum_total_price:.2f}) vs Shopify target ({shopify_target}): diff = {sum_total_price - shopify_target:+.2f}")
    print(f"  Our net_sales ({our_net_sales:.2f}) vs Report target ({report_target}): diff = {our_net_sales - report_target:+.2f}")
    
    return {
        "sum_total_price": sum_total_price,
        "our_net_sales": our_net_sales,
        "our_gross_sales": our_gross_sales,
        "sum_shipping": sum_shipping,
        "sum_tax": sum_tax,
        "sum_refunds": sum_refunds,
        "pending_total": pending_total
    }

if __name__ == "__main__":
    # Week 1: 09.02 - 15.02
    r1 = analyze_week(
        "Saptamana 09-15 Feb 2026",
        "2026-02-09T00:00:00+02:00", 
        "2026-02-15T23:59:59+02:00",
        shopify_target=21822,
        report_target=23674
    )
    
    # Week 2: Current week 16.02 - 18.02 (up to today)
    r2 = analyze_week(
        "Saptamana curenta 16-18 Feb 2026",
        "2026-02-16T00:00:00+02:00",
        "2026-02-18T23:59:59+02:00",
        shopify_target=20378,
        report_target=13208
    )
    
    print(f"\n{'='*80}")
    print("  SUMAR FINAL")
    print(f"{'='*80}")
    print(f"\nSaptamana 09-15 Feb:")
    print(f"  Shopify dashboard: 21822 | Report: 23674 | Diferenta: +1852")
    print(f"  API sum total_price: {r1['sum_total_price']:.2f}")
    print(f"  API our net_sales: {r1['our_net_sales']:.2f}")
    print(f"  API our gross_sales: {r1['our_gross_sales']:.2f}")
    
    print(f"\nSaptamana curenta 16-18 Feb:")
    print(f"  Shopify dashboard: 20378 | Report: 13208 | Diferenta: -7170")
    print(f"  API sum total_price: {r2['sum_total_price']:.2f}")
    print(f"  API our net_sales: {r2['our_net_sales']:.2f}")
    print(f"  API our gross_sales: {r2['our_gross_sales']:.2f}")
