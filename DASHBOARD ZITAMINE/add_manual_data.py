import json

filepath = r"c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\DASHBOARD ZITAMINE\dashboard_data.js"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Parse the JSON part
json_str = content.split("window.salesData =")[1].strip().rstrip(';')
data = json.loads(json_str)

if "manualConversionData" not in data:
    data["manualConversionData"] = {
        "2024-05": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-06": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-07": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-08": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-09": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-10": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-11": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2024-12": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-01": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-02": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-03": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-04": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-05": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-06": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-07": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-08": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-09": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-10": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-11": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2025-12": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2026-01": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2026-02": { "conversion_rate": 0.0, "checkout_rate": 0.0 },
        "2026-03": { "conversion_rate": 0.0, "checkout_rate": 0.0 }
    }
    
    # Save it back
    new_json_str = json.dumps(data, separators=(',', ':'))
    new_content = f"window.salesData = {new_json_str};"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Added manualConversionData.")
else:
    print("Already exists.")
