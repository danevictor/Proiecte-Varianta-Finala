"""Quick test: one Klaviyo reporting API request."""
import requests, json, sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

API_KEY = "pk_22984be8d2d781e708d8ead3ff6216956e"
HEADERS = {
    "Authorization": f"Klaviyo-API-Key {API_KEY}",
    "accept": "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
    "revision": "2024-10-15"
}

# Step 1: Get Placed Order metric ID (no page size limit)
print("1. Getting metrics...", flush=True)
resp = requests.get("https://a.klaviyo.com/api/metrics/", headers=HEADERS)
print(f"   Status: {resp.status_code}", flush=True)

if resp.status_code != 200:
    print(f"   ERROR: {resp.text[:500]}", flush=True)
    exit(1)

po_id = ""
for m in resp.json().get("data", []):
    name = m.get("attributes",{}).get("name","")
    if name == "Placed Order":
        po_id = m["id"]
        print(f"   Placed Order ID: {po_id}", flush=True)
        break

if not po_id:
    # Print all metric names to find it
    print("   All metrics found:", flush=True)
    for m in resp.json().get("data", []):
        name = m.get("attributes",{}).get("name","")
        print(f"     - {name} ({m['id']})", flush=True)
    exit(1)

# Step 2: Test campaign-values-report with last_12_months
print("\n2. Testing campaign-values-report (last_12_months)...", flush=True)
payload = {
    "data": {
        "type": "campaign-values-report",
        "attributes": {
            "statistics": ["opens", "open_rate", "clicks", "click_rate", "recipients", "conversion_value"],
            "timeframe": {"key": "last_12_months"},
            "conversion_metric_id": po_id,
            "filter": "equals(send_channel,'email')"
        }
    }
}
print(f"   Sending POST...", flush=True)
resp2 = requests.post("https://a.klaviyo.com/api/campaign-values-reports/", headers=HEADERS, json=payload, timeout=60)
print(f"   Status: {resp2.status_code}", flush=True)

if resp2.status_code != 200:
    print(f"   ERROR: {resp2.text[:1000]}", flush=True)
else:
    data = resp2.json()
    results = data.get("data", {}).get("attributes", {}).get("results", [])
    print(f"   SUCCESS! Got {len(results)} campaign results", flush=True)
    for r in results[:3]:
        g = r.get("groupings", {})
        s = r.get("statistics", {})
        print(f"     campaign_id={g.get('campaign_id','?')[:12]}  opens={s.get('opens',0)}  conversion_value={s.get('conversion_value',0)}", flush=True)

# Step 3: Test flow-values-report 
print("\n3. Testing flow-values-report (last_12_months)...", flush=True)
import time
time.sleep(5)  # Rate limit respect

payload3 = {
    "data": {
        "type": "flow-values-report",
        "attributes": {
            "statistics": ["opens", "open_rate", "clicks", "click_rate", "recipients", "conversion_value"],
            "timeframe": {"key": "last_12_months"},
            "conversion_metric_id": po_id,
            "filter": "equals(send_channel,'email')"
        }
    }
}
print(f"   Sending POST...", flush=True)
resp3 = requests.post("https://a.klaviyo.com/api/flow-values-reports/", headers=HEADERS, json=payload3, timeout=60)
print(f"   Status: {resp3.status_code}", flush=True)

if resp3.status_code != 200:
    print(f"   ERROR: {resp3.text[:1000]}", flush=True)
else:
    data3 = resp3.json()
    results3 = data3.get("data", {}).get("attributes", {}).get("results", [])
    print(f"   SUCCESS! Got {len(results3)} flow results", flush=True)
    for r in results3[:3]:
        g = r.get("groupings", {})
        s = r.get("statistics", {})
        print(f"     flow_id={g.get('flow_id','?')[:12]}  opens={s.get('opens',0)}  conversion_value={s.get('conversion_value',0)}", flush=True)

print("\nDONE!", flush=True)
