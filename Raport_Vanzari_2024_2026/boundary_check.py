"""
Check if Shopify's week definition or timezone causes the gap.
Also check orders on boundary dates (Feb 8 and Feb 16) that might overlap.
"""

import requests
from datetime import datetime

SHOPIFY_STORE_URL = "zitamine-ro.myshopify.com"
API_VERSION = "2024-10"
SHOPIFY_ACCESS_TOKEN = "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"

def get_headers():
    return {"X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN, "Content-Type": "application/json"}

def fetch_orders(start, end):
    url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/orders.json"
    params = {"status": "any", "created_at_min": start, "created_at_max": end, "limit": 250,
              "fields": "id,name,created_at,total_price,financial_status,cancelled_at,test,line_items,total_discounts,total_tax,shipping_lines,refunds"}
    orders = []
    headers = get_headers()
    while url:
        resp = requests.get(url, headers=headers, params=params)
        data = resp.json()
        orders.extend(data.get("orders", []))
        link = resp.headers.get("Link")
        url = None; params = {}
        if link:
            for l in link.split(", "):
                if 'rel="next"' in l: url = l.split("; ")[0].strip("<>")
    return [o for o in orders if not o.get("test")]

def shopify_total_sales(orders):
    """Calculate using formula: Gross - Discounts - Returns + Shipping + Taxes"""
    total = 0
    for o in orders:
        gross = sum(float(i.get("price",0)) * i.get("quantity",0) for i in o.get("line_items",[]))
        disc = float(o.get("total_discounts", 0))
        tax = float(o.get("total_tax", 0))
        ship = sum(float(s.get("price",0)) for s in o.get("shipping_lines",[]))
        returns = 0
        for r in o.get("refunds",[]):
            for rli in r.get("refund_line_items",[]): returns += float(rli.get("subtotal",0))
            # also check for shipping refund adjustments
            for adj in r.get("order_adjustments", []):
                if adj.get("kind") == "shipping_refund":
                    ship -= abs(float(adj.get("amount", 0)))
        # Tax refunds
        tax_refund = 0
        for r in o.get("refunds",[]):
            for rli in r.get("refund_line_items",[]):
                tax_refund += float(rli.get("total_tax", 0))
        
        order_total_sales = gross - disc - returns + ship + (tax - tax_refund)
        total += order_total_sales
    return total

# Check boundary dates - maybe Shopify's "week" starts on Monday?
# Feb 9 = Monday, Feb 15 = Sunday. So our range is Mon-Sun, which is typical.

# Check if orders on Feb 8 (late evening) might be included due to UTC
print("=== Checking Feb 8 (boundary day before) ===")
feb8_orders = fetch_orders("2026-02-08T20:00:00+02:00", "2026-02-09T00:00:00+02:00")
print(f"Orders on Feb 8 after 20:00 EET: {len(feb8_orders)}")
for o in feb8_orders:
    print(f"  {o['name']} at {o['created_at']} total={o['total_price']} status={o['financial_status']}")

# Check Feb 15 late night to Feb 16
print("\n=== Checking Feb 15-16 boundary ===")
feb15_late = fetch_orders("2026-02-15T20:00:00+02:00", "2026-02-16T04:00:00+02:00")
print(f"Orders at Feb 15-16 boundary: {len(feb15_late)}")
for o in feb15_late:
    print(f"  {o['name']} at {o['created_at']} total={o['total_price']} status={o['financial_status']}")

# Now recalculate with the Shopify formula INCLUDING tax refunds
print("\n=== Week 09-15 Feb with FULL Shopify formula (incl tax/shipping refund adjustments) ===")
week1 = fetch_orders("2026-02-09T00:00:00+02:00", "2026-02-15T23:59:59+02:00")
total_w1 = shopify_total_sales(week1)
print(f"Shopify Total Sales (our calc): {total_w1:.2f}")
print(f"Shopify Dashboard target:       21822")
print(f"Difference:                     {total_w1 - 21822:.2f}")

# Try without pending orders
paid_only = [o for o in week1 if o.get("financial_status") != "pending"]
total_w1_nopend = shopify_total_sales(paid_only)
print(f"\nWithout pending: {total_w1_nopend:.2f}")
print(f"Diff: {total_w1_nopend - 21822:.2f}")

# Try without voided too
no_voided = [o for o in paid_only if o.get("financial_status") != "voided"]
total_w1_clean = shopify_total_sales(no_voided)
print(f"Without pending+voided: {total_w1_clean:.2f}")
print(f"Diff: {total_w1_clean - 21822:.2f}")

# Current week with ALL orders
print("\n=== Week 16-18 Feb with FULL Shopify formula ===")
week2 = fetch_orders("2026-02-16T00:00:00+02:00", "2026-02-18T23:59:59+02:00")
total_w2 = shopify_total_sales(week2)
print(f"Shopify Total Sales (our calc): {total_w2:.2f}")
print(f"Shopify Dashboard target:       20378")
print(f"Difference:                     {total_w2 - 20378:.2f}")

# Also include Feb 19 (today)
print("\n=== Including Feb 19 ===")
week2_full = fetch_orders("2026-02-16T00:00:00+02:00", "2026-02-19T23:59:59+02:00")
total_w2_full = shopify_total_sales(week2_full)
print(f"Including today: {total_w2_full:.2f}")
print(f"Diff from 20378: {total_w2_full - 20378:.2f}")

# Print per-day breakdown
from collections import defaultdict
daily = defaultdict(float)
for o in week2_full:
    day = o['created_at'][:10]
    gross = sum(float(i.get("price",0)) * i.get("quantity",0) for i in o.get("line_items",[]))
    disc = float(o.get("total_discounts", 0))
    tax = float(o.get("total_tax", 0))
    ship = sum(float(s.get("price",0)) for s in o.get("shipping_lines",[]))
    daily[day] += gross - disc + ship + tax
print("\nDaily Total Sales (Gross-Disc+Ship+Tax):")
for d in sorted(daily):
    print(f"  {d}: {daily[d]:.2f}")
print(f"  Sum: {sum(daily.values()):.2f}")
