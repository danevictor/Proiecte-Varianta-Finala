import requests
import json

API_KEY = "pk_22984be8d2d781e708d8ead3ff6216956e"
BASE_URL = "https://a.klaviyo.com/api"
REVISION = "2024-10-15"

HEADERS = {
    "Authorization": f"Klaviyo-API-Key {API_KEY}",
    "accept": "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
    "revision": REVISION
}

def test_monthly_report():
    print("Fetching monthly volume for 'Received Email' (T6eJNE)...")
    
    payload = {
        "data": {
            "type": "metric-aggregate",
            "attributes": {
                "measurements": ["count"],
                "filter": [
                    "greater-or-equal(datetime,2025-01-01T00:00:00Z)",
                    "less-than(datetime,2025-12-31T23:59:59Z)"
                ],
                "interval": "month",
                "page_size": 500,
                "metric_id": "T6eJNE"
            }
        }
    }
    
    resp = requests.post(f"{BASE_URL}/metric-aggregates/", headers=HEADERS, json=payload)
    if resp.status_code != 200:
        print(f"Error: {resp.status_code} - {resp.text}")
        return
    
    data = resp.json()
    results = data.get('data', {}).get('attributes', {}).get('data', [])
    if results:
        print(f"DEBUG: First row keys: {results[0].keys()}")
        print(f"DEBUG: First row data: {results[0]}")
    for row in results:
        date = row.get('date', 'Unknown')
        count = row.get('measurements', {}).get('count', 0)
        print(f"  {date}: {count} emails")

if __name__ == "__main__":
    test_monthly_report()
