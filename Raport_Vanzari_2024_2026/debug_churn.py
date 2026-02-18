
import json
import os

file_path = r"c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\sales_data_2024_2025.js"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        # The file starts with "window.salesData = " and ends with ";"
        if "window.salesData =" in content:
            json_str = content.split("window.salesData =")[1].strip().rstrip(';')
            data = json.loads(json_str)

            months = ['2025-06', '2025-07', '2025-08', '2025-09']
            print(f"{'Month':<10} | {'Lost':<10} | {'Active Users':<12} | {'New Users':<12} | {'Formula Check (Lost/Active)'}")
            print("-" * 80)

            for m in months:
                if m in data.get('monthly', {}):
                    stats = data['monthly'][m]
                    conversions = stats.get('conversions', {})
                    
                    churn_otp = conversions.get('churn_otp', 0)
                    churn_sub1 = conversions.get('churn_sub1', 0)
                    churn_sub3 = conversions.get('churn_sub3', 0)
                    churn_sub6 = conversions.get('churn_sub6', 0)
                    
                    total_lost = churn_otp + churn_sub1 + churn_sub3 + churn_sub6
                    active_users = stats.get('customers_active', 0)
                    new_users = stats.get('customers_new', 0)
                    
                    rate = 0
                    if active_users > 0:
                        rate = (total_lost / active_users) * 100
                        
                    print(f"{m:<10} | {total_lost:<10} | {active_users:<12} | {new_users:<12} | {rate:.2f}%")
        else:
            print("Could not find window.salesData assignment")

except Exception as e:
    print(f"Error: {e}")
