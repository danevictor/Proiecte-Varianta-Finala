"""
Deep diagnostic: Understand exactly how Shopify calculates "Total Sales Over Time"
by examining orders at the line-item level and trying different formulas.

Shopify's documented formula:
  Total Sales = Gross Sales - Discounts - Returns + Shipping + Taxes + Duties

Where:
  Gross Sales = original_price * quantity (before any discounts)
  Discounts = line-level + order-level discounts
  Returns = refunded LINE ITEM values (NOT transaction amounts)
"""

import requests
import json

SHOPIFY_STORE_URL = "zitamine-ro.myshopify.com"
API_VERSION = "2024-10"
SHOPIFY_ACCESS_TOKEN = "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"

def get_headers():
    return {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }

def fetch_orders_detailed(start_date, end_date):
    """Fetch orders with full line item details"""
    url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/orders.json"
    params = {
        "status": "any",
        "created_at_min": start_date,
        "created_at_max": end_date,
        "limit": 250,
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

def analyze_shopify_formula(orders, label, shopify_target):
    print(f"\n{'='*80}")
    print(f"  {label}")
    print(f"{'='*80}")
    
    # Filter test orders
    orders = [o for o in orders if not o.get("test")]
    print(f"Total orders: {len(orders)}")
    
    # APPROACH: Calculate using Shopify's documented formula
    # Total Sales = Gross Sales - Discounts - Returns + Shipping + Taxes
    
    total_gross_sales = 0.0        # sum of original_price * qty for all items
    total_discounts = 0.0          # all discount amounts
    total_returns_line_items = 0.0 # refund line item values (product cost of returns)
    total_shipping = 0.0           # shipping charges
    total_taxes = 0.0              # all taxes
    total_refund_transactions = 0.0 # actual money refunded (transaction level)
    
    # Also track by status
    status_data = {}
    
    for o in orders:
        status = o.get("financial_status", "unknown")
        name = o.get("name")
        cancelled_at = o.get("cancelled_at")
        is_cancelled = cancelled_at is not None and cancelled_at != ""
        
        # --- Line Items ---
        order_gross = 0.0
        order_line_discounts = 0.0
        for item in o.get("line_items", []):
            qty = item.get("quantity", 0)
            price = float(item.get("price", 0))
            
            # Gross sales = price * qty (price is already per-unit, after variant pricing)
            # But does Shopify use pre-discount price or post-discount price for "gross"?
            # Shopify docs: "Gross sales is the total product sales BEFORE deducting discounts and returns"
            # The line_items.price field IS the pre-discount price per unit
            order_gross += price * qty
            
            # Line-level discounts
            for disc in item.get("discount_allocations", []):
                order_line_discounts += float(disc.get("amount", 0))
        
        # --- Order-level discounts ---
        # total_discounts includes both line-level and order-level
        order_total_discounts = float(o.get("total_discounts", 0))
        
        # --- Shipping ---
        order_shipping = 0.0
        for sl in o.get("shipping_lines", []):
            order_shipping += float(sl.get("price", 0))
        
        # --- Taxes ---
        order_taxes = float(o.get("total_tax", 0))
        
        # --- Refunds / Returns ---
        order_return_value = 0.0  # Product value of returns
        order_refund_txn = 0.0    # Transaction refund amount
        
        for r in o.get("refunds", []):
            # Line items returned (product value)
            for rli in r.get("refund_line_items", []):
                rli_subtotal = float(rli.get("subtotal", 0))  # product value
                order_return_value += rli_subtotal
            
            # Transaction amounts
            for t in r.get("transactions", []):
                if t.get("kind") == "refund" and t.get("status") == "success":
                    order_refund_txn += float(t.get("amount", 0))
        
        # Track
        if status not in status_data:
            status_data[status] = {"count": 0, "gross": 0.0, "discounts": 0.0, "returns": 0.0, 
                                    "shipping": 0.0, "taxes": 0.0, "total_price": 0.0, 
                                    "refund_txn": 0.0, "cancelled": 0}
        sd = status_data[status]
        sd["count"] += 1
        sd["gross"] += order_gross
        sd["discounts"] += order_total_discounts
        sd["returns"] += order_return_value
        sd["shipping"] += order_shipping
        sd["taxes"] += order_taxes
        sd["total_price"] += float(o.get("total_price", 0))
        sd["refund_txn"] += order_refund_txn
        if is_cancelled:
            sd["cancelled"] += 1
        
        # Accumulate totals
        total_gross_sales += order_gross
        total_discounts += order_total_discounts
        total_returns_line_items += order_return_value
        total_shipping += order_shipping
        total_taxes += order_taxes
        total_refund_transactions += order_refund_txn
    
    # === RESULTS ===
    print(f"\n--- Per-Status Breakdown ---")
    for st in sorted(status_data.keys()):
        sd = status_data[st]
        print(f"  {st} ({sd['count']} orders, {sd['cancelled']} cancelled):")
        print(f"    gross={sd['gross']:.2f}, discounts={sd['discounts']:.2f}, returns={sd['returns']:.2f}")
        print(f"    shipping={sd['shipping']:.2f}, taxes={sd['taxes']:.2f}, total_price={sd['total_price']:.2f}")
        print(f"    refund_txn={sd['refund_txn']:.2f}")
    
    print(f"\n--- Totals (ALL orders) ---")
    print(f"  Gross Sales (price*qty):     {total_gross_sales:.2f}")
    print(f"  Discounts (total_discounts): {total_discounts:.2f}")
    print(f"  Returns (refund line items): {total_returns_line_items:.2f}")
    print(f"  Shipping:                    {total_shipping:.2f}")
    print(f"  Taxes:                       {total_taxes:.2f}")
    print(f"  Refund Transactions:         {total_refund_transactions:.2f}")
    
    # --- TRY DIFFERENT FORMULAS ---
    print(f"\n--- Formula Attempts ---")
    
    # Formula A: Shopify documented
    # Total Sales = Gross - Discounts - Returns + Shipping + Taxes
    fA = total_gross_sales - total_discounts - total_returns_line_items + total_shipping + total_taxes
    print(f"  A) Gross - Discounts - Returns(line) + Ship + Tax = {fA:.2f}")
    
    # Formula B: Same but using refund transactions instead of line item returns
    fB = total_gross_sales - total_discounts - total_refund_transactions + total_shipping + total_taxes
    print(f"  B) Gross - Discounts - Refunds(txn) + Ship + Tax = {fB:.2f}")
    
    # Formula C: Just paid orders total_price
    paid_total = sum(sd["total_price"] for st, sd in status_data.items() if st == "paid")
    print(f"  C) Paid orders total_price = {paid_total:.2f}")
    
    # Formula D: All orders total_price - refund transactions
    all_total = sum(sd["total_price"] for sd in status_data.values())
    fD = all_total - total_refund_transactions
    print(f"  D) All total_price - refund_txn = {fD:.2f}")
    
    # Formula E: Exclude voided and subtract refunds from all
    voided_total = sum(sd["total_price"] for st, sd in status_data.items() if st == "voided")
    pending_total = sum(sd["total_price"] for st, sd in status_data.items() if st == "pending")
    fE = all_total - voided_total - total_refund_transactions
    print(f"  E) All - voided - refund_txn = {fE:.2f}")
    
    # Formula F: Net sales (gross - discounts - returns)
    net_sales = total_gross_sales - total_discounts - total_returns_line_items
    print(f"  F) Net Sales only (Gross - Disc - Returns) = {net_sales:.2f}")
    
    # Formula G: Net + ship + tax, excluding voided completely
    voided_gross = status_data.get("voided", {}).get("gross", 0)
    voided_disc = status_data.get("voided", {}).get("discounts", 0)
    voided_ship = status_data.get("voided", {}).get("shipping", 0)
    voided_tax = status_data.get("voided", {}).get("taxes", 0)
    fG = (total_gross_sales - voided_gross) - (total_discounts - voided_disc) - total_returns_line_items + (total_shipping - voided_ship) + (total_taxes - voided_tax)
    print(f"  G) Formula A minus voided orders = {fG:.2f}")
    
    # Formula H: Exclude voided AND pending
    pending_gross = status_data.get("pending", {}).get("gross", 0)
    pending_disc = status_data.get("pending", {}).get("discounts", 0)
    pending_ship = status_data.get("pending", {}).get("shipping", 0)
    pending_tax = status_data.get("pending", {}).get("taxes", 0)
    fH = fG - pending_gross + pending_disc - pending_ship - pending_tax
    print(f"  H) Formula G minus pending orders = {fH:.2f}")
    
    # Formula I: total_price of (paid + partially_paid + partially_refunded) - refund_txn
    valid_total = sum(sd["total_price"] for st, sd in status_data.items() 
                      if st in ("paid", "partially_paid", "partially_refunded"))
    fI = valid_total - total_refund_transactions
    print(f"  I) (paid+partial) total_price - refund_txn = {fI:.2f}")
    
    # Formula J: Include refunded orders' total but subtract refund amounts
    refunded_total = sum(sd["total_price"] for st, sd in status_data.items() if st == "refunded")
    fJ = valid_total + refunded_total - total_refund_transactions
    print(f"  J) (paid+partial+refunded) total_price - refund_txn = {fJ:.2f}")
    
    print(f"\n  >>> SHOPIFY TARGET: {shopify_target}")
    
    # Find closest match
    formulas = {"A": fA, "B": fB, "C": fC if 'fC' in dir() else paid_total, 
                "D": fD, "E": fE, "F": net_sales, "G": fG, "H": fH, "I": fI, "J": fJ}
    for name, val in sorted(formulas.items(), key=lambda x: abs(x[1] - shopify_target)):
        diff = val - shopify_target
        print(f"  {name}: {val:.2f} (diff: {diff:+.2f})")
    
    return {
        "gross": total_gross_sales,
        "discounts": total_discounts,
        "returns_line": total_returns_line_items,
        "shipping": total_shipping,
        "taxes": total_taxes,
        "refund_txn": total_refund_transactions,
        "status_data": status_data
    }

if __name__ == "__main__":
    # Week 1: 09-15 Feb
    orders1 = fetch_orders_detailed("2026-02-09T00:00:00+02:00", "2026-02-15T23:59:59+02:00")
    r1 = analyze_shopify_formula(orders1, "Saptamana 09-15 Feb 2026", 21822)
    
    # Week 2: 16-18 Feb (current)
    orders2 = fetch_orders_detailed("2026-02-16T00:00:00+02:00", "2026-02-18T23:59:59+02:00")
    r2 = analyze_shopify_formula(orders2, "Saptamana curenta 16-18 Feb 2026", 20378)
