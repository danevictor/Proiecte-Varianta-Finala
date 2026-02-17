
import requests
import json
from datetime import datetime, timedelta

SHOPIFY_STORE_URL = "zitamine-ro.myshopify.com"
API_VERSION = "2024-10"
SHOPIFY_ACCESS_TOKEN = "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"

def get_shopify_headers():
    return {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }

def fetch_weekly_orders():
    # Time range: Feb 9 to Feb 15 (end of day)
    start_date = "2026-02-09T00:00:00"
    end_date = "2026-02-15T23:59:59"
    
    url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/orders.json"
    
    params = {
        "status": "any",
        "created_at_min": start_date,
        "created_at_max": end_date,
        "limit": 250,
        "fields": "id,name,created_at,total_price,subtotal_price,total_tax,total_discounts,financial_status,fulfillment_status,refunds,cancelled_at,test"
    }
    
    orders = []
    headers = get_shopify_headers()
    
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

def calculate_metrics(orders):
    total_sales = 0.0
    gross_sales = 0.0 # Subtotal? Or Total before discounts?
    # Shopify Definition:
    # Gross Sales = Product Price * Qty - Discounts + Taxes + Shipping? 
    # Usually Gross Sales in reports = Price * Qty + Taxes + Shipping (before returns).
    # Net Sales = Gross Sales - Discounts - Returns.
    # Total Sales = Gross Sales - Discounts - Returns + Shipping + Taxes.
    
    # Let's sum typical fields
    sum_total_price = 0.0
    sum_tax = 0.0
    sum_refunds = 0.0
    
    breakdown_status = {"paid": 0, "pending": 0, "refunded": 0, "voided": 0, "partially_paid": 0, "partially_refunded": 0}
    breakdown_val = {"paid": 0.0, "pending": 0.0, "refunded": 0.0, "voided": 0.0, "partially_paid": 0.0, "partially_refunded": 0.0}

    print(f"--- Analyzing {len(orders)} Orders (Feb 9-15) ---")
    
    for o in orders:
        if o.get("test"): continue # Skip test orders
        
        price = float(o.get("total_price", 0))
        status = o.get("financial_status")
        
        sum_total_price += price
        sum_tax += float(o.get("total_tax", 0))
        
        # Refunds
        refund_amount = 0.0
        for r in o.get("refunds", []):
            for t in r.get("transactions", []):
                if t.get("kind") == "refund" and t.get("status") == "success":
                    refund_amount += float(t.get("amount", 0))
        
        sum_refunds += refund_amount
        
        if status in breakdown_status:
            breakdown_status[status] += 1
            breakdown_val[status] += price
        else:
            print(f"Unknown status: {status}")

    print(f"Total Value of Orders Created (Sum of total_price): {sum_total_price:.2f}")
    print(f"Total Refunds processed (on these orders): {sum_refunds:.2f}")
    print(f"Total (Price - Refunds): {sum_total_price - sum_refunds:.2f}")
    
    print("\n--- Breakdown by Financial Status ---")
    for k, v in breakdown_status.items():
        if v > 0:
            print(f"{k}: count={v}, sum={breakdown_val[k]:.2f}")

    print("\n--- Comparison Targets ---")
    print(f"Shopify 'Total Sales' target: 21,822")
    print(f"Our Report (Current): 19,905")
    
    # Calculate "Paid Only" total
    paid_sum = breakdown_val["paid"] + breakdown_val["partially_paid"] + breakdown_val["partially_refunded"] + breakdown_val["refunded"]
    # Usually pending are excluded from sales reports if cash basis?
    # Shopify usually includes pending in "Total Sales" dashboard unless filtered.
    
    print(f"Sum of Paid+Refunded+Partial (excluding Pending/Voided): {paid_sum:.2f}")

if __name__ == "__main__":
    orders = fetch_weekly_orders()
    calculate_metrics(orders)
