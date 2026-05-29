import requests
import json
import os
from datetime import datetime, timedelta
import time

# Shopify Store Credentials
SHOPIFY_STORE_URL = "zitamine-ro.myshopify.com"
API_VERSION = "2024-10"
import os, json
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
try:
    with open(os.path.join(os.path.dirname(SCRIPT_DIR), 'secrets.json'), 'r') as f:
        SHOPIFY_ACCESS_TOKEN = json.load(f).get('SHOPIFY_ACCESS_TOKEN', '')
except:
    SHOPIFY_ACCESS_TOKEN = ""

def get_shopify_headers(token=None):
    if token is None:
        token = SHOPIFY_ACCESS_TOKEN
    return {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json"
    }

def fetch_orders(token, days_back=1):
    """
    Fetches orders from the last N days.
    """
    url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/orders.json"
    
    # Calculate date range
    # Fetch from slightly before yesterday to ensure overlap/completeness
    start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%dT00:00:00')
    
    params = {
        "status": "any",
        "created_at_min": start_date,
        "limit": 250,
        "fields": "id,name,email,created_at,currency,subtotal_price,total_tax,total_price,total_discounts,line_items,refunds,shipping_lines,cancelled_at,tags,discount_codes,financial_status"
    }
    
    headers = get_shopify_headers(token)
    all_orders = []
    
    print(f"Fetching orders since {start_date}...")
    
    while url:
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            orders = data.get("orders", [])
            all_orders.extend(orders)
            
            # Check for pagination (Link header)
            link_header = response.headers.get("Link")
            url = None
            params = {} # Clear params for next page
            
            if link_header:
                links = link_header.split(", ")
                for link in links:
                    if 'rel="next"' in link:
                        url = link.split("; ")[0].strip("<>")
                        break
            
            time.sleep(0.5)
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data: {e}")
            break
            
    print(f"Fetched {len(all_orders)} orders.")
    return all_orders

def save_to_csv(orders, output_dir):
    # Simplistic CSV conversion for continuity with PS1 script
    # Ideally PS1 should consume JSON, but we'll stick to CSV for now to match current architecture
    import csv
    
    # Check what day these orders belong to
    # We might have orders from yesterday and today.
    # Group by date?
    # For simplicity, we append to a "daily_fetch.csv" or similar
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    filename = os.path.join(output_dir, f"orders_fetch_{timestamp}.csv")
    
    # We need to map JSON fields to CSV columns expected by PS1
    # PS1 expects: Name,Email,Created at,Cancelled at,Total,Refunded Amount,Shipping,Taxes,Discount Amount,Discount Code,Tags,Lineitem name,Lineitem quantity,Lineitem price
    
    # This is complex because one order -> multiple rows (lines)
    
    csv_rows = []
    header = ["Name","Email","Financial Status","Created at","Cancelled at","Total","Subtotal","Net Sales","Returns","Refunded Amount","Shipping","Taxes","Discount Amount","Discount Code","Tags","Lineitem name","Lineitem quantity","Lineitem price","Lineitem properties"]
    
    for o in orders:
        subtotal = float(o.get("subtotal_price", 0))
        discounts = float(o.get("total_discounts", 0))
        
        # Net Sales = Subtotal - Discounts (Shopify formula: gross - discounts)
        # Note: subtotal_price already has line-level discounts applied.
        # total_discounts includes both line-level and order-level discounts.
        # So Net Sales at order level = subtotal (which is gross - line discounts) - order-level discounts
        # But since subtotal already accounts for line discounts, we just use subtotal directly.
        # Actually, Shopify's subtotal_price = sum(line_item.price * qty) - line_item_discounts
        # And total_discounts = order-level discounts + line-level discounts
        # So: Gross = subtotal + discounts = price*qty before any discounts
        # Net Sales = Gross - Discounts = subtotal + discounts - discounts = subtotal
        # Wait, that's just subtotal. Let's verify:
        # Gross Sales = sum(price * qty) for all line items
        gross_sales = sum(float(item.get("price", 0)) * item.get("quantity", 0) for item in o.get("line_items", []))
        net_sales = gross_sales - discounts
        
        # Returns = product value of refunded line items (not transaction amount)
        returns_value = 0.0
        refund_txn_total = 0.0
        for r in o.get("refunds", []):
            for rli in r.get("refund_line_items", []):
                returns_value += float(rli.get("subtotal", 0))
            for t in r.get("transactions", []):
                if t.get("kind") == "refund" and t.get("status") == "success":
                    refund_txn_total += float(t.get("amount", 0))
        
        base_row = {
            "Name": o.get("name"),
            "Email": o.get("email"),
            "Financial Status": o.get("financial_status"),
            "Created at": o.get("created_at"),
            "Cancelled at": o.get("cancelled_at", ""),
            "Total": o.get("total_price"),
            "Subtotal": subtotal,
            "Net Sales": net_sales,
            "Returns": returns_value,
            "Refunded Amount": refund_txn_total,
            "Shipping": sum(float(x.get("price",0)) for x in o.get("shipping_lines", [])),
            "Taxes": o.get("total_tax"),
            "Discount Amount": discounts,
            "Discount Code": "",
            "Tags": o.get("tags")
        }

        # Extract Discount Code (First one found)
        # Shopify stores this in discount_codes usually, or we can infer from discount_applications
        # The fields param requested 'total_discounts', but not 'discount_codes'. 
        # API version 2024-10 might use discount_codes or discount_applications.
        # Let's check what we get. The params included 'total_discounts' but we should add 'discount_codes' to fields.
        
        # However, for now, let's look at the Order object structure we get.
        # If we didn't request it, we won't get it.
        # We need to update the fields list in fetch_orders first.
        
        dc_list = o.get("discount_codes", [])
        if dc_list:
            base_row["Discount Code"] = dc_list[0].get("code", "")
        else:
            base_row["Discount Code"] = ""

        # Line Items
        for item in o.get("line_items", []):
            row = base_row.copy()
            row["Lineitem name"] = item.get("name")
            row["Lineitem quantity"] = item.get("quantity")
            row["Lineitem price"] = item.get("price")
            # Extract line item properties (e.g., Recomandate: da, Package Type: complet)
            props = item.get("properties", [])
            if props:
                prop_str = ";".join(f"{p.get('name','')}:{p.get('value','')}" for p in props if p.get('name','').strip())
                row["Lineitem properties"] = prop_str
            else:
                row["Lineitem properties"] = ""
            csv_rows.append(row)
            
    if not csv_rows:
        print("No rows to save.")
        return

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(csv_rows)
        
    print(f"Saved {len(csv_rows)} rows to {filename}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Fetch Shopify Orders')
    parser.add_argument('--days', type=int, default=2, help='Number of days back to fetch')
    args = parser.parse_args()
    
    output_dir = r"c:\Users\Zitamine\Victor Dane\Antigravity\Rapoarte\Date_Brute"
    token = SHOPIFY_ACCESS_TOKEN
    
    if token:
        orders = fetch_orders(token, days_back=args.days)
        if orders:
            save_to_csv(orders, output_dir)
    else:
        print("No token provided.")
