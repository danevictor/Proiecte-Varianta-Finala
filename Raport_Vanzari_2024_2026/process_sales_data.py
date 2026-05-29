import pandas as pd
import glob
import os
import json
from datetime import datetime

# Configuration
INPUT_DIR = r"c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Rapoarte\Date_Brute"
OUTPUT_FILE = r"c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte Varianta Finala\Raport_Vanzari_2024_2026\sales_data_2024_2025.js"

def load_data(input_dir):
    all_files = glob.glob(os.path.join(input_dir, "**/*.csv"), recursive=True)
    df_list = []
    
    print(f"Found {len(all_files)} CSV files.")
    
    for filename in all_files:
        try:
            # Read CSV with some robustness for different encodings
            try:
                df = pd.read_csv(filename, encoding='utf-8', low_memory=False)
            except UnicodeDecodeError:
                df = pd.read_csv(filename, encoding='ISO-8859-1', low_memory=False)
                
            df_list.append(df)
            print(f"Loaded: {os.path.basename(filename)} ({len(df)} rows)")
        except Exception as e:
            print(f"Error loading {filename}: {e}")

    if not df_list:
        return pd.DataFrame()
        
    full_df = pd.concat(df_list, ignore_index=True)
    return full_df

def process_data(df):
    # 1. Date Conversion
    df['Created at'] = pd.to_datetime(df['Created at'], utc=True, errors='coerce')
    df['Cancelled at'] = pd.to_datetime(df['Cancelled at'], utc=True, errors='coerce')
    
    # 2. Filter Validity
    # Define valid rows: Orders that are NOT Cancellations (unless useful for cancel stats)?
    # Actually, we need to track cancellations separately.
    
    # Common transformations
    df['Month'] = df['Created at'].dt.strftime('%Y-%m')
    df['Year'] = df['Created at'].dt.year
    df['Quarter'] = df['Created at'].dt.to_period("Q").astype(str)
    
    # Ensure numeric columns
    numeric_cols = ['Subtotal', 'Shipping', 'Taxes', 'Total', 'Discount Amount', 'Refunded Amount', 'Lineitem quantity', 'Lineitem price', 'Lineitem discount']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # 3. Order Level Data (Deduplicate by Name/ID)
    # Group by Order ID (Name) to get order-level metrics (Total Sales, Refunds, etc.)
    # We take the FIRST occurrence for order-level fields because lines repeat
    order_cols = ['Name', 'Email', 'Financial Status', 'Created at', 'Subtotal', 'Shipping', 'Taxes', 'Total', 'Discount Code', 'Discount Amount', 'Refunded Amount', 'Cancelled at', 'Month', 'Year', 'Quarter']
    orders_df = df.drop_duplicates(subset=['Name'])[order_cols].copy()
    
    # Identify Canceled Orders
    orders_df['Is_Canceled'] = orders_df['Cancelled at'].notna()
    
    # Identify Valid Orders (Not canceled) for Revenue calculation? 
    # Usually, if canceled, revenue is 0. If refunded, revenue is Total - Refund.
    # Logic: 
    # If Canceled: Revenue = 0 (Total is voided)
    # Else: Revenue = Total - Refunded Amount
    
    orders_df['Net_Sales'] = orders_df.apply(
        lambda x: 0 if x['Is_Canceled'] else (x['Total'] - x['Refunded Amount']), axis=1
    )
    
    # 4. Item Level Data
    # For product analysis, we need lines.
    # Exclude canceled orders from product sales counts? Yes, usually.
    valid_items_df = df[df['Cancelled at'].isna()].copy()
    
    return orders_df, valid_items_df

def aggregate_metrics(orders_df, items_df, period_col):
    metrics = {}
    
    # Group Orders by Period
    grouped_orders = orders_df.groupby(period_col)
    
    for period, grp in grouped_orders:
        period_str = str(period)
        
        total_orders = len(grp)
        valid_orders = len(grp[~grp['Is_Canceled']])
        canceled_orders = len(grp[grp['Is_Canceled']])
        
        gross_sales = grp.loc[~grp['Is_Canceled'], 'Total'].sum()
        total_refunds = grp.loc[~grp['Is_Canceled'], 'Refunded Amount'].sum()
        net_sales = grp['Net_Sales'].sum()
        
        shipping_cost = grp.loc[~grp['Is_Canceled'], 'Shipping'].sum()
        taxes = grp.loc[~grp['Is_Canceled'], 'Taxes'].sum()
        discounts = grp.loc[~grp['Is_Canceled'], 'Discount Amount'].sum()
        
        aov = net_sales / valid_orders if valid_orders > 0 else 0
        
        # Product Analysis for this period
        period_items = items_df[items_df[period_col] == period]
        
        # Top Products by Revenue
        # Revenue per line = (Price * Qty) - Discount? Or just taken from line item price?
        # Dataset has 'Lineitem price' (unit price) and 'Lineitem quantity'.
        # We need to consider line item discount if exists.
        period_items['Line_Revenue'] = (period_items['Lineitem price'] * period_items['Lineitem quantity'])
        
        top_products = period_items.groupby('Lineitem name').agg({
            'Lineitem quantity': 'sum',
            'Line_Revenue': 'sum'
        }).reset_index().sort_values('Lineitem quantity', ascending=False).head(10)
        
        top_products_list = top_products.to_dict(orient='records')
        
        # Discounts Analysis
        # Count non-empty discount codes
        top_discounts = grp[grp['Discount Code'].notna() & (grp['Discount Code'] != "")].groupby('Discount Code').size().sort_values(ascending=False).head(5).to_dict()

        metrics[period_str] = {
            'period': period_str,
            'total_orders': int(total_orders),
            'valid_orders': int(valid_orders),
            'canceled_orders': int(canceled_orders),
            'gross_sales': float(gross_sales),
            'total_refunds': float(total_refunds),
            'net_sales': float(net_sales),
            'shipping': float(shipping_cost),
            'taxes': float(taxes),
            'discounts_value': float(discounts),
            'aov': float(aov),
            'top_products': top_products_list,
            'top_discounts': top_discounts
        }
        
    return metrics

def main():
    print("Loading data...")
    df = load_data(INPUT_DIR)
    
    if df.empty:
        print("No data found!")
        return

    print("Processing data...")
    orders_df, items_df = process_data(df)
    
    # Aggregations
    print("Aggregating Monthly...")
    monthly_stats = aggregate_metrics(orders_df, items_df, 'Month')
    
    print("Aggregating Quarterly...")
    quarterly_stats = aggregate_metrics(orders_df, items_df, 'Quarter')
    
    print("Aggregating Annual...")
    orders_df['Year'] = orders_df['Year'].astype(str)
    items_df['Year'] = items_df['Year'].astype(str)
    annual_stats = aggregate_metrics(orders_df, items_df, 'Year')

    print("Aggregating Daily...")
    orders_df['Date'] = orders_df['Created at'].dt.strftime('%Y-%m-%d')
    items_df['Date'] = items_df['Created at'].dt.strftime('%Y-%m-%d')
    daily_stats = aggregate_metrics(orders_df, items_df, 'Date')
    
    final_output = {
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'monthly': monthly_stats,
        'quarterly': quarterly_stats,
        'annual': annual_stats,
        'daily': daily_stats
    }
    
    # Save to JS variable
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json_str = json.dumps(final_output, indent=4, ensure_ascii=False)
        f.write(f"window.salesData = {json_str};")
        
    print(f"Successfully saved analysis to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
