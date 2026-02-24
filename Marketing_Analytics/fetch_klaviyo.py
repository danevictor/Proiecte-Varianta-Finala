"""
Klaviyo Data Fetcher — Antigravity Marketing Analytics
Connects to Klaviyo API to extract real campaign, flow, and metric data.
Outputs: klaviyo_data.json

Strategy: Use AGGREGATE reporting requests to minimize API calls.
Handles 429 throttling gracefully — saves whatever data is available.
"""

import requests
import json
import sys
import os
import io
import time
from datetime import datetime, timedelta

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ===============================================
# CONFIG
# ===============================================
API_KEY = "pk_22984be8d2d781e708d8ead3ff6216956e"
BASE_URL = "https://a.klaviyo.com/api"
REVISION = "2024-10-15"

HEADERS = {
    "Authorization": f"Klaviyo-API-Key {API_KEY}",
    "accept": "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
    "revision": REVISION
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Valid statistics for Klaviyo Reporting API
REPORT_STATS = [
    "opens", "opens_unique", "open_rate",
    "clicks", "clicks_unique", "click_rate",
    "recipients", "delivered",
    "conversion_value", "conversion_uniques", "revenue_per_recipient"
]


# ===============================================
# API HELPERS
# ===============================================
def api_get(endpoint, params=None):
    """Generic GET with pagination."""
    url = f"{BASE_URL}/{endpoint}"
    all_data = []
    while url:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"  [ERR] {resp.status_code}: {resp.text[:300]}", flush=True)
            return all_data
        data = resp.json()
        all_data.extend(data.get("data", []))
        url = data.get("links", {}).get("next", None)
        params = None
    return all_data


def api_post_report(endpoint, payload):
    """POST for reporting. Returns None if throttled, with clear message."""
    url = f"{BASE_URL}/{endpoint}"
    try:
        resp = requests.post(url, headers=HEADERS, json=payload, timeout=60)
    except requests.exceptions.Timeout:
        print(f"  [TIMEOUT] Request timed out", flush=True)
        return None

    if resp.status_code == 429:
        detail = ""
        try:
            detail = resp.json().get("errors", [{}])[0].get("detail", "")
        except Exception:
            pass
        print(f"  [THROTTLED] 429 - {detail}", flush=True)
        return None

    if resp.status_code not in [200, 201]:
        print(f"  [ERR] {resp.status_code}: {resp.text[:500]}", flush=True)
        return None

    return resp.json()


# ===============================================
# 1. TEST CONNECTION
# ===============================================
def test_connection():
    print("[1/6] Testing API connection...", flush=True)
    resp = requests.get(f"{BASE_URL}/metrics/", headers=HEADERS, timeout=15)
    if resp.status_code == 200:
        count = len(resp.json().get("data", []))
        print(f"  OK ({count} metrics found)", flush=True)
        return True
    print(f"  FAIL ({resp.status_code})", flush=True)
    return False


# ===============================================
# 2. FETCH METRICS (for Placed Order ID)
# ===============================================
def fetch_placed_order_id():
    print("[2/6] Finding 'Placed Order' metric...", flush=True)
    metrics = api_get("metrics")
    for m in metrics:
        name = m.get("attributes", {}).get("name", "")
        if name == "Placed Order":
            print(f"  Found: {m['id']}", flush=True)
            return m["id"]
    # Fallback
    for m in metrics:
        name = m.get("attributes", {}).get("name", "").lower()
        if "placed" in name and "order" in name:
            print(f"  Found (fuzzy): {m['id']}", flush=True)
            return m["id"]
    print("  NOT FOUND!", flush=True)
    return None


# ===============================================
# 3. FETCH FLOWS
# ===============================================
def fetch_flows():
    print("[3/6] Fetching active flows...", flush=True)
    flows = api_get("flows", params={
        "fields[flow]": "name,status,trigger_type,created,updated",
        "filter": "equals(status,'live')"
    })
    print(f"  Found {len(flows)} active flows", flush=True)
    result = []
    for f in flows:
        attrs = f.get("attributes", {})
        result.append({
            "id": f["id"],
            "name": attrs.get("name", "Unknown"),
            "status": attrs.get("status", "").upper(),
            "triggerType": attrs.get("trigger_type", ""),
            "created": attrs.get("created", ""),
        })
    return result


# ===============================================
# 4. FETCH CAMPAIGNS (only 2025+)
# ===============================================
def fetch_campaigns():
    print("[4/6] Fetching email campaigns...", flush=True)
    campaigns = api_get("campaigns", params={
        "filter": "equals(messages.channel,'email')",
        "fields[campaign]": "name,status,send_time,scheduled_at,created_at",
        "sort": "-scheduled_at"
    })
    # Filter only 2025+ campaigns
    result = []
    for c in campaigns:
        attrs = c.get("attributes", {})
        send_time = attrs.get("send_time") or attrs.get("scheduled_at") or ""
        # Only include 2025+ campaigns
        if send_time and send_time[:4] < "2025":
            continue
        status = attrs.get("status", "").capitalize()
        result.append({
            "id": c["id"],
            "name": attrs.get("name", "Unknown"),
            "status": status,
            "sendTime": send_time,
            "created": attrs.get("created_at", ""),
        })
    
    sent_count = len([c for c in result if c["status"] == "Sent"])
    print(f"  Found {len(result)} campaigns (2025+), {sent_count} sent", flush=True)
    return result


# ===============================================
# 5. AGGREGATE REPORTING (2-3 requests total)
# ===============================================
# ===============================================
# 5. AGGREGATE REPORTING
# ===============================================
def fetch_flow_report(placed_order_id):
    """Single aggregate: all flows, last 12 months."""
    print("  (a) Flow performance list...", flush=True)
    payload = {
        "data": {
            "type": "flow-values-report",
            "attributes": {
                "statistics": REPORT_STATS,
                "timeframe": {"key": "last_12_months"},
                "conversion_metric_id": placed_order_id,
                "filter": "equals(send_channel,'email')"
            }
        }
    }
    result = api_post_report("flow-values-reports", payload)
    flow_perf = {}
    if result:
        results_data = result.get("data", {}).get("attributes", {}).get("results", [])
        for r in results_data:
            fid = r.get("groupings", {}).get("flow_id")
            if fid: flow_perf[fid] = r.get("statistics", {})
        print(f"      OK - {len(flow_perf)} flows with data", flush=True)
    return flow_perf

def fetch_campaign_report(placed_order_id):
    """Single aggregate: all campaigns, last 12 months."""
    print("  (b) Campaign performance list...", flush=True)
    payload = {
        "data": {
            "type": "campaign-values-report",
            "attributes": {
                "statistics": REPORT_STATS,
                "timeframe": {"key": "last_12_months"},
                "conversion_metric_id": placed_order_id,
                "filter": "equals(send_channel,'email')"
            }
        }
    }
    result = api_post_report("campaign-values-reports", payload)
    campaign_perf = {}
    if result:
        results_data = result.get("data", {}).get("attributes", {}).get("results", [])
        for r in results_data:
            cid = r.get("groupings", {}).get("campaign_id")
            if cid: campaign_perf[cid] = r.get("statistics", {})
        print(f"      OK - {len(campaign_perf)} campaigns with data", flush=True)
    return campaign_perf

def fetch_monthly_aggregates(placed_order_id):
    """Fetch total sends and revenue grouped by month for the trend."""
    print("  (c) Total Monthly Trend (Flows + Campaigns)...", flush=True)
    
    # Klaviyo limits reporting to 1 year range. Use 2025-01 to 2026-02.
    # We can do one call for 2025 and one for 2026.
    ranges = [
        ("2025-01-01T00:00:00Z", "2026-01-01T00:00:00Z", 2025),
        ("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z", 2026)
    ]
    
    monthly_data = {} # key: "YYYY-MM"
    volume_metric_id = "T6eJNE"
    
    for start, end, year in ranges:
        # Volume (Received Email)
        payload_v = {
            "data": {
                "type": "metric-aggregate",
                "attributes": {
                    "measurements": ["count"],
                    "filter": [f"greater-or-equal(datetime,{start})", f"less-than(datetime,{end})"],
                    "interval": "month",
                    "page_size": 500,
                    "metric_id": volume_metric_id
                }
            }
        }
        resp_v = api_post_report("metric-aggregates", payload_v)
        if resp_v:
            # The API returns one row with a list of values for each month in the interval
            data_list = resp_v.get("data", {}).get("attributes", {}).get("data", [])
            if data_list:
                counts = data_list[0].get("measurements", {}).get("count", [])
                for i, val in enumerate(counts):
                    m_key = f"{year}-{i+1:02d}"
                    if m_key not in monthly_data: monthly_data[m_key] = {"sends": 0, "revenue": 0.0}
                    monthly_data[m_key]["sends"] = int(val)
        
        # Revenue (Placed Order)
        payload_r = {
            "data": {
                "type": "metric-aggregate",
                "attributes": {
                    "measurements": ["sum_value"],
                    "filter": [f"greater-or-equal(datetime,{start})", f"less-than(datetime,{end})"],
                    "interval": "month",
                    "page_size": 500,
                    "metric_id": placed_order_id
                }
            }
        }
        resp_r = api_post_report("metric-aggregates", payload_r)
        if resp_r:
            data_list = resp_r.get("data", {}).get("attributes", {}).get("data", [])
            if data_list:
                revs = data_list[0].get("measurements", {}).get("sum_value", [])
                for i, val in enumerate(revs):
                    m_key = f"{year}-{i+1:02d}"
                    if m_key not in monthly_data: monthly_data[m_key] = {"sends": 0, "revenue": 0.0}
                    monthly_data[m_key]["revenue"] = float(val)

    # Filter out empty future months
    final_trend = {k: v for k, v in monthly_data.items() if v["sends"] > 0 or v["revenue"] > 0}
    print(f"      OK - {len(final_trend)} months tracked", flush=True)
    return final_trend


# ===============================================
# 6. COMPOSE FINAL DATA
# ===============================================
def compose_data(flows, flow_perf, campaigns, campaign_perf, monthly_map):
    """Build the final data structure."""
    print("[6/6] Composing final data...", flush=True)
    
    # Process flows
    flows_out = []
    total_flow_rev = 0.0
    total_flow_sends = 0
    
    for f in flows:
        perf = flow_perf.get(f["id"], {})
        sends = int(perf.get("recipients", 0))
        opens = int(perf.get("opens", 0))
        clicks = int(perf.get("clicks", 0))
        
        # Use simple division since linting round() is weird with float/int mixtures
        open_rate = round((opens / sends * 100), 1) if sends > 0 else 0
        click_rate = round((clicks / sends * 100), 1) if sends > 0 else 0
        revenue = float(perf.get("conversion_value", 0))
        rpe = round((revenue / sends), 2) if sends > 0 else 0
        
        rating = "no_data"
        if sends > 0:
            if rpe >= 1.5 and open_rate >= 45: rating = "excellent"
            elif rpe >= 0.5 and open_rate >= 30: rating = "good"
            else: rating = "acceptable"
        
        flows_out.append({
            "id": f["id"], "name": f["name"], "status": f["status"],
            "triggerType": f.get("triggerType", ""), "sends": sends,
            "opens": opens, "clicks": clicks, "openRate": open_rate,
            "clickRate": click_rate, "revenue": round(revenue, 2),
            "rpe": rpe, "performanceRating": rating
        })
        total_flow_rev += revenue
        total_flow_sends += sends
    
    flows_out.sort(key=lambda x: x["revenue"], reverse=True)
    
    # Process campaigns
    campaigns_out = []
    total_camp_rev = 0.0
    total_camp_sends = 0
    
    for c in campaigns:
        if c["status"] != "Sent": continue
        perf = campaign_perf.get(c["id"], {})
        sends = int(perf.get("recipients", 0))
        opens = int(perf.get("opens", 0))
        clicks = int(perf.get("clicks", 0))
        open_rate = round((opens / sends * 100), 1) if sends > 0 else 0
        click_rate = round((clicks / sends * 100), 1) if sends > 0 else 0
        revenue = float(perf.get("conversion_value", 0))
        rpe = round((revenue / sends), 2) if sends > 0 else 0
        sent_date = c.get("sendTime", "")[:10]
        
        campaigns_out.append({
            "id": c["id"], "name": c["name"], "sentDate": sent_date,
            "sends": sends, "opens": opens, "clicks": clicks,
            "openRate": open_rate, "clickRate": click_rate,
            "revenue": round(revenue, 2), "rpe": rpe,
            "performanceRating": "excellent" if rpe >= 1.5 else "good" if rpe >= 0.5 else "acceptable"
        })
        total_camp_rev += revenue
        total_camp_sends += sends
    
    campaigns_out.sort(key=lambda x: x["sentDate"], reverse=True)
    
    month_names_ro = {"01":"Ian","02":"Feb","03":"Mar","04":"Apr","05":"Mai","06":"Iun","07":"Iul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec"}
    
    monthly_trend = []
    # Count campaigns per month manually to keep that metric
    camp_counts = {}
    for c in campaigns_out:
        if c.get("sentDate"):
            m_key = c["sentDate"][:7]
            camp_counts[m_key] = camp_counts.get(m_key, 0) + 1

    for mk in sorted(monthly_map.keys()):
        y, m = mk.split("-")
        label = f"{month_names_ro.get(m, m)} {y}"
        d = monthly_map[mk]
        monthly_trend.append({
            "month": label, "sends": d["sends"],
            "revenue": round(d["revenue"], 2), "campaigns": camp_counts.get(mk, 0)
        })
    
    # Summary
    total_rev = total_flow_rev + total_camp_rev
    total_sends = total_flow_sends + total_camp_sends
    
    return {
        "lastUpdated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "currency": "RON",
        "dataSource": "Klaviyo API (aggregate)",
        "note": "Campaign report may be partial if API was throttled",
        "summary": {
            "totalRevenue": round(total_rev, 2),
            "flowRevenue": round(total_flow_rev, 2),
            "campaignRevenue": round(total_camp_rev, 2),
            "totalSends": total_sends,
            "activeFlows": len(flows_out),
            "sentCampaigns": len(campaigns_out),
            "flowsWithData": len([f for f in flows_out if f["sends"] > 0]),
            "campaignsWithData": len([c for c in campaigns_out if c["sends"] > 0])
        },
        "monthlyTrend": monthly_trend, "flows": flows_out, "campaigns": campaigns_out
    }


# ===============================================
# MAIN
# ===============================================
def main():
    print("=" * 50, flush=True)
    print("  KLAVIYO DATA FETCHER - Antigravity", flush=True)
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}", flush=True)
    print("=" * 50, flush=True)
    
    if not test_connection(): sys.exit(1)
    
    placed_order_id = fetch_placed_order_id()
    if not placed_order_id: sys.exit(1)
    
    flows = fetch_flows()
    campaigns = fetch_campaigns()
    
    # Reporting
    print("[5/6] Fetching performance reports...", flush=True)
    flow_perf = fetch_flow_report(placed_order_id)
    time.sleep(2)
    campaign_perf = fetch_campaign_report(placed_order_id)
    time.sleep(2)
    monthly_map = fetch_monthly_aggregates(placed_order_id)
    
    # 6. Compose & save
    data = compose_data(flows, flow_perf, campaigns, campaign_perf, monthly_map)
    
    json_path = os.path.join(SCRIPT_DIR, "klaviyo_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    s = data["summary"]
    print(f"\nRESULTS:\n  Flows: {s['activeFlows']} | Campaigns: {s['sentCampaigns']}\n  Total Rev: RON {s['totalRevenue']:,.2f}\n  Saved: {json_path}", flush=True)

if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
