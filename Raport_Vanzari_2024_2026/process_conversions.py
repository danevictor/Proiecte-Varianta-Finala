import csv
import json
import os

base_dir = r"c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity"
raw_data_dir = os.path.join(base_dir, "DATE BRUTE")
js_filepath = os.path.join(base_dir, r"Proiecte-Varianta-Finala\DASHBOARD ZITAMINE\dashboard_data.js")

target_csv = os.path.join(raw_data_dir, "sesiuni 2024- actual.csv")
if not os.path.exists(target_csv):
    print("Could not find the target CSV file.")
    exit(1)

conversion_data = {}

with open(target_csv, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        month_raw = row['Month'].replace('"', '').strip()
        if not month_raw:
            continue
            
        # Parse M/D/YYYY
        parts = month_raw.split('/')
        if len(parts) == 3:
            m = int(parts[0])
            y = int(parts[2])
            month_key = f"{y}-{m:02d}"
        else:
            month_key = month_raw[:7] # Fallback if it's still YYYY-MM
            
        try:
            conv_rate = float(row['Conversion rate']) * 100
        except (ValueError, TypeError, KeyError):
            conv_rate = 0.0

        try:
            chk_rate = float(row['Checkout conversion rate']) * 100
        except (ValueError, TypeError, KeyError):
            chk_rate = 0.0
            
        try:
            sessions = int(row['Sessions'])
        except (ValueError, TypeError, KeyError):
            sessions = 0
            
        conversion_data[month_key] = {
            "conversion_rate": round(conv_rate, 2),
            "checkout_rate": round(chk_rate, 2),
            "sessions": sessions
        }

with open(js_filepath, 'r', encoding='utf-8') as f:
    content = f.read()

json_str = content.split("window.salesData =")[1].strip().rstrip(';')
data = json.loads(json_str)

if "manualConversionData" not in data:
    data["manualConversionData"] = {}

# We overwrite the entire dictionary to clear out corrupted old keys like '1/1/202'
data["manualConversionData"] = conversion_data

new_json_str = json.dumps(data, separators=(',', ':'))
new_content = f"window.salesData = {new_json_str};"

with open(js_filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Successfully fixed and updated {len(conversion_data)} months of data.")
