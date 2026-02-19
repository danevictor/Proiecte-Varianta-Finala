import json

with open('dashboard_data.js', 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the JSON object between "window.salesData = " and the final ";"
start = content.index('{')
# Find matching closing brace
depth = 0
end = start
for i in range(start, len(content)):
    if content[i] == '{': depth += 1
    elif content[i] == '}': depth -= 1
    if depth == 0:
        end = i + 1
        break
json_str = content[start:end]
data = json.loads(json_str)

print('Generated at:', data.get('generated_at'))

daily = data.get('daily', {})
w1 = ['2026-02-09','2026-02-10','2026-02-11','2026-02-12','2026-02-13','2026-02-14','2026-02-15']
w2 = ['2026-02-16','2026-02-17','2026-02-18','2026-02-19']

t1 = 0
t2 = 0

print('\n--- WEEK 1 (Feb 9-15) ---')
for d in w1:
    if d in daily:
        ns = daily[d].get('net_sales', 0)
        gs = daily[d].get('gross_sales', 0)
        vo = daily[d].get('valid_orders', 0)
        to_ = daily[d].get('total_orders', 0)
        sh = daily[d].get('shipping', 0)
        tx = daily[d].get('taxes', 0)
        print(f'  {d}: net_sales={ns:.2f}  gross={gs:.2f}  valid={vo}  total={to_}  ship={sh:.2f}  tax={tx:.2f}')
        t1 += ns
    else:
        print(f'  {d}: NO DATA')
print(f'  W1 TOTAL net_sales: {t1:.2f}')

print('\n--- WEEK 2 (Feb 16-19) ---')
for d in w2:
    if d in daily:
        ns = daily[d].get('net_sales', 0)
        gs = daily[d].get('gross_sales', 0)
        vo = daily[d].get('valid_orders', 0)
        to_ = daily[d].get('total_orders', 0)
        sh = daily[d].get('shipping', 0)
        tx = daily[d].get('taxes', 0)
        print(f'  {d}: net_sales={ns:.2f}  gross={gs:.2f}  valid={vo}  total={to_}  ship={sh:.2f}  tax={tx:.2f}')
        t2 += ns
    else:
        print(f'  {d}: NO DATA')
print(f'  W2 TOTAL net_sales: {t2:.2f}')
