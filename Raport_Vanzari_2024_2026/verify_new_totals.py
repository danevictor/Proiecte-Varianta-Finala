import json

with open('dashboard_data.js', 'r', encoding='utf-8-sig') as f:
    content = f.read()

start = content.index('{')
depth = 0
end_pos = start
for i in range(start, len(content)):
    if content[i] == '{': depth += 1
    elif content[i] == '}': depth -= 1
    if depth == 0:
        end_pos = i + 1
        break
data = json.loads(content[start:end_pos])

print('Generated at:', data.get('generated_at'))

daily = data.get('daily', {})
w1 = ['2026-02-09','2026-02-10','2026-02-11','2026-02-12','2026-02-13','2026-02-14','2026-02-15']
w2 = ['2026-02-16','2026-02-17','2026-02-18','2026-02-19']

sum_ns_w1 = 0; sum_ts_w1 = 0; sum_gs_w1 = 0
sum_ns_w2 = 0; sum_ts_w2 = 0; sum_gs_w2 = 0

print('\n--- WEEK 1 (Feb 9-15) --- Shopify target: 21,822 ---')
for d in w1:
    if d in daily:
        ns = daily[d].get('net_sales', 0)
        ts = daily[d].get('total_sales', 0)
        gs = daily[d].get('gross_sales', 0)
        vo = daily[d].get('valid_orders', 0)
        sh = daily[d].get('shipping', 0)
        tx = daily[d].get('taxes', 0)
        rt = daily[d].get('returns', 0)
        print(f'  {d}: total_sales={ts:.2f}  net_sales={ns:.2f}  gross={gs:.2f}  returns={rt:.2f}  ship={sh:.2f}  tax={tx:.2f}  valid={vo}')
        sum_ns_w1 += ns; sum_ts_w1 += ts; sum_gs_w1 += gs
    else:
        print(f'  {d}: NO DATA')
print(f'  W1 TOTALS: total_sales={sum_ts_w1:.2f}  net_sales={sum_ns_w1:.2f}  gross={sum_gs_w1:.2f}')
print(f'  Shopify target: 21822  |  Diff: {sum_ts_w1 - 21822:.2f}')

print('\n--- WEEK 2 (Feb 16-19) --- Shopify target: 20,378 ---')
for d in w2:
    if d in daily:
        ns = daily[d].get('net_sales', 0)
        ts = daily[d].get('total_sales', 0)
        gs = daily[d].get('gross_sales', 0)
        vo = daily[d].get('valid_orders', 0)
        sh = daily[d].get('shipping', 0)
        tx = daily[d].get('taxes', 0)
        rt = daily[d].get('returns', 0)
        print(f'  {d}: total_sales={ts:.2f}  net_sales={ns:.2f}  gross={gs:.2f}  returns={rt:.2f}  ship={sh:.2f}  tax={tx:.2f}  valid={vo}')
        sum_ns_w2 += ns; sum_ts_w2 += ts; sum_gs_w2 += gs
    else:
        print(f'  {d}: NO DATA')
print(f'  W2 TOTALS: total_sales={sum_ts_w2:.2f}  net_sales={sum_ns_w2:.2f}  gross={sum_gs_w2:.2f}')
print(f'  Shopify target: 20378  |  Diff: {sum_ts_w2 - 20378:.2f}')

# Check monthly Feb 2026
monthly = data.get('monthly', {})
feb = monthly.get('2026-02', {})
if feb:
    print(f'\n--- Feb 2026 Monthly ---')
    print(f'  total_sales: {feb.get("total_sales", 0):.2f}')
    print(f'  net_sales:   {feb.get("net_sales", 0):.2f}')
    print(f'  gross_sales: {feb.get("gross_sales", 0):.2f}')
    print(f'  returns:     {feb.get("returns", 0):.2f}')
    print(f'  shipping:    {feb.get("shipping", 0):.2f}')
    print(f'  taxes:       {feb.get("taxes", 0):.2f}')
