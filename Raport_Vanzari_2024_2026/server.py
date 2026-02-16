"""
Zitamine Sales Report Server
Serves the sales report and provides a live update endpoint from Shopify.
Usage: python server.py
Then open http://localhost:8080
"""

import http.server
import json
import urllib.request
import urllib.parse
import os
import re
import sys
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─── CONFIG ───
SHOPIFY_STORE = "zitamine-ro.myshopify.com"
SHOPIFY_TOKEN = "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"
API_VERSION = "2024-10"
PORT = 8080
DATA_FILE = "sales_data_2024_2025.js"

# ─── SHOPIFY API ───

def shopify_request(endpoint, params=None):
    """Make a request to Shopify Admin API with pagination support."""
    url = f"https://{SHOPIFY_STORE}/admin/api/{API_VERSION}/{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(url, headers={
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        "Content-Type": "application/json"
    })
    
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        # Get pagination link
        link_header = resp.headers.get("Link", "")
        next_url = None
        if 'rel="next"' in link_header:
            import re as _re
            m = _re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            if m:
                next_url = m.group(1)
        return data, next_url


def fetch_orders_for_month(year, month):
    """Fetch all orders for a given month from Shopify."""
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)
    
    all_orders = []
    params = {
        "status": "any",
        "limit": 250,
        "created_at_min": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "created_at_max": end.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    
    page = 1
    next_url = None
    
    while True:
        if next_url:
            # Parse page_info from next URL
            parsed = urllib.parse.urlparse(next_url)
            qs = urllib.parse.parse_qs(parsed.query)
            page_info = qs.get("page_info", [None])[0]
            if page_info:
                params = {"limit": 250, "page_info": page_info}
            else:
                break
        
        data, next_url = shopify_request("orders.json", params)
        orders = data.get("orders", [])
        if not orders:
            break
        all_orders.extend(orders)
        page += 1
        
        if not next_url:
            break
    
    return all_orders


def calculate_stats(orders, period_key):
    """Calculate sales statistics from a list of orders."""
    stats = {
        "valid_orders": 0,
        "total_orders": 0,
        "canceled_orders": 0,
        "refunded_count": 0,
        "gross_sales": 0.0,
        "net_sales": 0.0,
        "shipping": 0.0,
        "taxes": 0.0,
        "discounts_value": 0.0,
        "total_refunds": 0.0,
        "aov": 0.0,
        "top_products": [],
        "top_discounts": {},
        "all_products": [],
    }
    
    product_map = {}  # name -> {SKU, qty, rev, returns}
    discount_map = defaultdict(int)
    
    for order in orders:
        stats["total_orders"] += 1
        
        # Skip test orders
        if order.get("test", False):
            continue
        
        # Count cancelled
        if order.get("cancelled_at"):
            stats["canceled_orders"] += 1
            continue
        
        stats["valid_orders"] += 1
        
        subtotal = float(order.get("subtotal_price", 0))
        total_tax = float(order.get("total_tax", 0))
        total_discounts = float(order.get("total_discounts", 0))
        total_price = float(order.get("total_price", 0))
        
        # Shipping
        shipping_cost = 0.0
        for line in order.get("shipping_lines", []):
            shipping_cost += float(line.get("price", 0))
        
        # Refunds
        refund_amount = 0.0
        if order.get("refunds"):
            stats["refunded_count"] += 1
            for refund in order["refunds"]:
                for trans in refund.get("transactions", []):
                    if trans.get("kind") == "refund" and trans.get("status") == "success":
                        refund_amount += float(trans.get("amount", 0))
        
        stats["total_refunds"] += refund_amount
        
        # Aggregates
        stats["gross_sales"] += (subtotal + total_discounts)
        stats["discounts_value"] += total_discounts
        stats["taxes"] += total_tax
        stats["shipping"] += shipping_cost
        stats["net_sales"] += (total_price - refund_amount)
        
        # Line items
        for item in order.get("line_items", []):
            name = item.get("name", "Unknown")
            sku = item.get("sku", "N/A") or "N/A"
            qty = int(item.get("quantity", 0))
            price = float(item.get("price", 0))
            line_rev = qty * price
            
            if name not in product_map:
                product_map[name] = {
                    "Lineitem name": name,
                    "SKU": sku,
                    "Lineitem quantity": 0,
                    "Line_Revenue": 0.0,
                    "Returns_Count": 0,
                }
            product_map[name]["Lineitem quantity"] += qty
            product_map[name]["Line_Revenue"] += line_rev
        
        # Discount codes
        for dc in order.get("discount_codes", []):
            code = dc.get("code", "")
            if code:
                discount_map[code] += 1
    
    # Build products list sorted by revenue
    all_products = sorted(product_map.values(), key=lambda x: x["Line_Revenue"], reverse=True)
    stats["all_products"] = all_products
    stats["top_products"] = all_products[:10]
    stats["top_discounts"] = dict(sorted(discount_map.items(), key=lambda x: x[1], reverse=True))
    
    # AOV
    if stats["valid_orders"] > 0:
        stats["aov"] = round(stats["net_sales"] / stats["valid_orders"], 2)
    
    return stats


def calculate_daily_stats(orders):
    """Group orders by date and calculate per-day stats."""
    daily = {}
    
    for order in orders:
        # Skip test orders
        if order.get("test", False):
            continue
        
        # Get the date from created_at
        created = order.get("created_at", "")
        if not created:
            continue
        day_key = created[:10]  # "2026-02-15"
        
        if day_key not in daily:
            daily[day_key] = {
                "net_sales": 0.0,
                "gross_sales": 0.0,
                "valid_orders": 0,
                "total_orders": 0,
                "canceled_orders": 0,
                "discounted_orders": 0,
                "refunded_count": 0,
                "shipping": 0.0,
                "taxes": 0.0,
                "discounts_value": 0.0,
                "total_refunds": 0.0,
                "products": {},
                "discount_codes": {},
            }
        
        d = daily[day_key]
        d["total_orders"] += 1
        
        # Count cancelled
        if order.get("cancelled_at"):
            d["canceled_orders"] += 1
            continue
        
        d["valid_orders"] += 1
        
        subtotal = float(order.get("subtotal_price", 0))
        total_tax = float(order.get("total_tax", 0))
        total_discounts = float(order.get("total_discounts", 0))
        total_price = float(order.get("total_price", 0))
        
        # Shipping
        shipping_cost = 0.0
        for line in order.get("shipping_lines", []):
            shipping_cost += float(line.get("price", 0))
        
        # Refunds
        refund_amount = 0.0
        if order.get("refunds"):
            d["refunded_count"] += 1
            for refund in order["refunds"]:
                for trans in refund.get("transactions", []):
                    if trans.get("kind") == "refund" and trans.get("status") == "success":
                        refund_amount += float(trans.get("amount", 0))
        d["total_refunds"] += refund_amount
        
        # Aggregates
        d["gross_sales"] += (subtotal + total_discounts)
        d["discounts_value"] += total_discounts
        d["taxes"] += total_tax
        d["shipping"] += shipping_cost
        d["net_sales"] += (total_price - refund_amount)
        
        # Discounted order count
        discount_codes = order.get("discount_codes", [])
        if discount_codes:
            d["discounted_orders"] += 1
        
        # Line items
        for item in order.get("line_items", []):
            name = item.get("name", "Unknown")
            qty = int(item.get("quantity", 0))
            price = float(item.get("price", 0))
            line_rev = qty * price
            if name not in d["products"]:
                d["products"][name] = {"name": name, "qty": 0, "rev": 0.0}
            d["products"][name]["qty"] += qty
            d["products"][name]["rev"] += line_rev
        
        # Discount codes
        for dc in discount_codes:
            code = dc.get("code", "")
            if code:
                d["discount_codes"][code] = d["discount_codes"].get(code, 0) + 1
    
    # Convert products dict to sorted list for each day
    for day_key, d in daily.items():
        d["products"] = sorted(d["products"].values(), key=lambda x: x["rev"], reverse=True)
        d["discount_codes"] = dict(sorted(d["discount_codes"].items(), key=lambda x: x[1], reverse=True))
        # Round floats
        d["net_sales"] = round(d["net_sales"], 2)
        d["gross_sales"] = round(d["gross_sales"], 2)
        d["shipping"] = round(d["shipping"], 2)
        d["taxes"] = round(d["taxes"], 2)
        d["discounts_value"] = round(d["discounts_value"], 2)
        d["total_refunds"] = round(d["total_refunds"], 2)
        if d["valid_orders"] > 0:
            d["aov"] = round(d["net_sales"] / d["valid_orders"], 2)
        else:
            d["aov"] = 0.0
    
    return daily


def update_sales_data(full_history=False):
    """Fetch data from Shopify and update the JS data file."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, DATA_FILE)
    
    # Load existing data
    existing_data = {"generated_at": "", "monthly": {}, "daily": {}}
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            content = f.read()
            m = re.search(r'window\.salesData\s*=\s*(\{[\s\S]*\});', content)
            if m:
                try:
                    existing_data = json.loads(m.group(1))
                    if "daily" not in existing_data:
                        existing_data["daily"] = {}
                except json.JSONDecodeError:
                    print("Warning: Could not parse existing data, starting fresh")
                    existing_data = {"generated_at": "", "monthly": {}, "daily": {}}
    
    now = datetime.now()
    
    if full_history:
        # Process all months from Jan 2024 to now
        date = datetime(2024, 1, 1)
        months_to_process = []
        while date <= now:
            months_to_process.append((date.year, date.month))
            if date.month == 12:
                date = datetime(date.year + 1, 1, 1)
            else:
                date = datetime(date.year, date.month + 1, 1)
    else:
        # Only current month
        months_to_process = [(now.year, now.month)]
    
    results = {}
    for year, month in months_to_process:
        key = f"{year:04d}-{month:02d}"
        print(f"Fetching orders for {key}...")
        
        orders = fetch_orders_for_month(year, month)
        print(f"  Found {len(orders)} orders")
        
        if orders:
            stats = calculate_stats(orders, key)
            existing_data["monthly"][key] = stats
            
            # Compute daily stats
            daily_stats = calculate_daily_stats(orders)
            existing_data["daily"].update(daily_stats)
            print(f"  Daily breakdown: {len(daily_stats)} days")
            
            results[key] = {
                "orders": stats["valid_orders"],
                "net_sales": round(stats["net_sales"], 2),
                "gross_sales": round(stats["gross_sales"], 2),
            }
            print(f"  Net Sales: {stats['net_sales']:.2f}, Valid Orders: {stats['valid_orders']}")
        else:
            print(f"  No orders found")
            results[key] = {"orders": 0, "net_sales": 0, "gross_sales": 0}
    
    # Update timestamp
    existing_data["generated_at"] = now.strftime("%Y-%m-%d %H:%M:%S")
    
    # Write JS file with clean JSON
    js_content = "window.salesData = " + json.dumps(existing_data, ensure_ascii=False, indent=2) + ";"
    with open(data_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print(f"\nData file updated: {data_path}")
    return results


# ─── HTTP SERVER ───

class SalesReportHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves files and handles API requests."""
    
    def __init__(self, *args, **kwargs):
        # Serve from the script's directory
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        if parsed.path == "/api/update":
            self.handle_update(full_history=False)
        elif parsed.path == "/api/update-full":
            self.handle_update(full_history=True)
        elif parsed.path == "/" or parsed.path == "":
            # Redirect to the report
            self.send_response(302)
            self.send_header("Location", "/Raport_Vanzari_2024_2026.html")
            self.end_headers()
        else:
            # Serve static files (JS, HTML, CSS, etc.)
            super().do_GET()
    
    def handle_update(self, full_history=False):
        """Handle the API update request."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        
        try:
            results = update_sales_data(full_history=full_history)
            response = {
                "success": True,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "months": results,
            }
        except Exception as e:
            response = {
                "success": False,
                "error": str(e),
            }
            print(f"Update error: {e}")
        
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))
    
    def log_message(self, format, *args):
        # Custom log format
        if "/api/" in str(args[0]) if args else False:
            print(f"[API] {args[0]}")
        else:
            pass  # Suppress static file logs


# ─── DAILY SCHEDULER ───

import threading
import time as _time

DAILY_UPDATE_HOUR = 8  # 8:00 AM
DAILY_UPDATE_MINUTE = 0

def _seconds_until_next_run():
    """Calculate seconds until next 8:00 AM."""
    now = datetime.now()
    target = now.replace(hour=DAILY_UPDATE_HOUR, minute=DAILY_UPDATE_MINUTE, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return (target - now).total_seconds()

def _daily_scheduler():
    """Background thread that triggers update at 8 AM daily."""
    while True:
        wait_secs = _seconds_until_next_run()
        next_run = datetime.now() + timedelta(seconds=wait_secs)
        print(f"[Scheduler] Următorul update automat: {next_run.strftime('%Y-%m-%d %H:%M:%S')}")
        _time.sleep(wait_secs)
        
        print(f"\n[Scheduler] ═══ Update automat la {datetime.now().strftime('%H:%M:%S')} ═══")
        try:
            results = update_sales_data(full_history=False)
            for key, val in results.items():
                print(f"  {key}: {val['orders']} comenzi, {val['net_sales']:.2f} RON")
            print(f"[Scheduler] ═══ Update complet! ═══\n")
        except Exception as e:
            print(f"[Scheduler] ❌ Eroare la update: {e}\n")


def main():
    print(f"""
╔══════════════════════════════════════════════════╗
║   🟢 Zitamine Sales Report Server               ║
║                                                  ║
║   Report:  http://localhost:{PORT}                 ║
║   Update:  http://localhost:{PORT}/api/update       ║
║   Full:    http://localhost:{PORT}/api/update-full   ║
║                                                  ║
║   🕐 Auto-update zilnic la 08:00                 ║
║   Press Ctrl+C to stop                           ║
╚══════════════════════════════════════════════════╝
""")
    
    # Start daily scheduler in background
    scheduler = threading.Thread(target=_daily_scheduler, daemon=True)
    scheduler.start()
    
    server = http.server.HTTPServer(("", PORT), SalesReportHandler)
    
    # Auto-open browser
    import webbrowser
    webbrowser.open(f"http://localhost:{PORT}")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    if "--update-only" in sys.argv:
        # Standalone mode: just update and exit (for Task Scheduler)
        print("Running standalone update...")
        full = "--full" in sys.argv
        results = update_sales_data(full_history=full)
        for key, val in results.items():
            print(f"  {key}: {val['orders']} comenzi, {val['net_sales']:.2f} RON")
        print("Done!")
    else:
        main()
