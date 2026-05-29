import pandas as pd

file_path = 'master_orders.csv'
df = pd.read_csv(file_path, encoding='utf-8-sig', low_memory=False)

# Clean up financial status and cancel status
df = df[df['Financial Status'].str.lower() != 'pending']
df = df[df['Cancelled at'].isna() | (df['Cancelled at'] == '')]
df = df.dropna(subset=['Email'])
df['Email'] = df['Email'].str.strip().str.lower()

# Sort by created at
df['Created at'] = pd.to_datetime(df['Created at'], errors='coerce', utc=True)
df = df.dropna(subset=['Created at'])
df = df.sort_values(by=['Email', 'Created at'])

print("=== Analyze Products ===")
print("Are there any '3 luni' products?")
three_months_products = df[df['Lineitem name'].str.contains('3 luni|trei luni', case=False, na=False)]['Lineitem name'].unique()
for p in three_months_products:
    print(f" - {p}")

print("\n=== Customer Retention (All Customers) ===")
# Count unique orders per customer
# Some orders might have multiple rows (line items), so group by Email and Name (order ID)
orders_per_customer = df.groupby('Email')['Name'].nunique()
total_customers = len(orders_per_customer)

has_1 = total_customers
has_2 = (orders_per_customer >= 2).sum()
has_3 = (orders_per_customer >= 3).sum()
has_4 = (orders_per_customer >= 4).sum()
has_5 = (orders_per_customer >= 5).sum()

print(f"Total Unique Customers: {total_customers}")
print(f"Had at least 2 orders: {has_2} ({has_2/total_customers*100:.2f}%)")
print(f"Had at least 3 orders: {has_3} ({has_3/total_customers*100:.2f}%)")
print(f"Had at least 4 orders: {has_4} ({has_4/total_customers*100:.2f}%)")
print(f"Had at least 5 orders: {has_5} ({has_5/total_customers*100:.2f}%)")

print("\n=== Retention for customers who bought '3 luni' products ===")
if len(three_months_products) > 0:
    three_months_customers = df[df['Lineitem name'].isin(three_months_products)]['Email'].unique()
    orders_per_3m_customer = orders_per_customer[three_months_customers]
    total_3m = len(orders_per_3m_customer)
    
    h2 = (orders_per_3m_customer >= 2).sum()
    h3 = (orders_per_3m_customer >= 3).sum()
    h4 = (orders_per_3m_customer >= 4).sum()
    
    print(f"Total '3 luni' Customers: {total_3m}")
    print(f"Had at least 2 orders: {h2} ({h2/total_3m*100:.2f}%)")
    print(f"Had at least 3 orders: {h3} ({h3/total_3m*100:.2f}%)")
    print(f"Had at least 4 orders: {h4} ({h4/total_3m*100:.2f}%)")
else:
    print("No '3 luni' products found.")

# What if 'pe trei luni' means 'calculate retention at month 3'?
# Let's do a quick cohort analysis for customers who had their first order at least 3 months ago
three_months_ago = pd.Timestamp.utcnow() - pd.DateOffset(months=3)
first_order_dates = df.groupby('Email')['Created at'].min()
mature_customers = first_order_dates[first_order_dates <= three_months_ago].index

mature_orders = orders_per_customer[mature_customers]
total_mature = len(mature_orders)
m2 = (mature_orders >= 2).sum()
m3 = (mature_orders >= 3).sum()
m4 = (mature_orders >= 4).sum()
m5 = (mature_orders >= 5).sum()

print("\n=== Customers who joined >3 months ago ===")
print(f"Total mature customers: {total_mature}")
print(f"Had at least 2 orders: {m2} ({m2/total_mature*100:.2f}%)")
print(f"Had at least 3 orders: {m3} ({m3/total_mature*100:.2f}%)")
print(f"Had at least 4 orders: {m4} ({m4/total_mature*100:.2f}%)")
print(f"Had at least 5 orders: {m5} ({m5/total_mature*100:.2f}%)")

