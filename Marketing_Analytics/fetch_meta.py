"""
Meta Ads Data Fetcher — Antigravity Marketing Analytics
Connects to Meta Marketing API to extract campaign, ad set, and ad data.
Outputs: meta_data.json
"""

import requests
import json
import sys
import os
import io
from datetime import datetime, timedelta

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ===============================================
# CONFIG
# ===============================================
ACCESS_TOKEN = "EAAZB7coPkGZBABQ2G0v6buNsREHUxBrZAZBV3VAV6nNgZCmP25AeQ2OXEWTv5f1VF3ZAhHs2IbDunVcNWXrqizy1ZCWiZCqmL9WnRIFpa1sJB0wD0lepa9jz9ZAeUNVyPewArEyAyZCVNMeb6a2ogY8cgbPg3o4mxa75vppteCuDpjqU5bK2cLymVE9dWZAhlKNWfYDXFZAr1bRe"
AD_ACCOUNT_ID = "act_357463294861060"
BASE = "https://graph.facebook.com/v21.0"
START_DATE = "2025-01-01"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


# ===============================================
# API HELPERS
# ===============================================
def api_get(endpoint, params=None):
    """GET request with pagination support."""
    if params is None:
        params = {}
    params["access_token"] = ACCESS_TOKEN
    
    url = f"{BASE}/{endpoint}"
    all_data = []
    
    while url:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"  [ERR] {resp.status_code}: {resp.text[:500]}", flush=True)
            return all_data
        data = resp.json()
        all_data.extend(data.get("data", []))
        # Pagination
        url = data.get("paging", {}).get("next", None)
        params = None  # next URL has params built in
    
    return all_data


# ===============================================
# 1. FETCH CAMPAIGNS
# ===============================================
def fetch_campaigns():
    print("[1/4] Fetching campaigns...", flush=True)
    campaigns = api_get(f"{AD_ACCOUNT_ID}/campaigns", {
        "fields": "name,status,objective,start_time,stop_time,daily_budget,lifetime_budget,created_time,updated_time",
        "limit": 100,
        "date_preset": "maximum"
    })
    print(f"  Found {len(campaigns)} campaigns", flush=True)
    for c in campaigns:
        print(f"    - {c.get('name', '?')[:55]} ({c.get('status', '?')})", flush=True)
    return campaigns


# ===============================================
# 2. FETCH CAMPAIGN INSIGHTS (performance data)
# ===============================================
def fetch_campaign_insights():
    """Fetch aggregated insights for all campaigns from Jan 2025."""
    print("[2/4] Fetching campaign insights...", flush=True)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    insights = api_get(f"{AD_ACCOUNT_ID}/insights", {
        "fields": ",".join([
            "campaign_id", "campaign_name",
            "impressions", "reach", "clicks", "ctr", "cpc", "cpm",
            "spend", "actions", "action_values", "cost_per_action_type",
            "frequency", "unique_clicks", "unique_ctr"
        ]),
        "time_range": json.dumps({"since": START_DATE, "until": today}),
        "level": "campaign",
        "limit": 500
    })
    
    print(f"  Got insights for {len(insights)} campaigns", flush=True)
    
    # Parse into dict keyed by campaign_id
    perf = {}
    for row in insights:
        cid = row.get("campaign_id", "")
        
        # Extract purchases and purchase value from actions
        purchases = 0
        purchase_value = 0.0
        
        actions = row.get("actions", [])
        for a in actions:
            if a.get("action_type") == "purchase":
                purchases = int(a.get("value", 0))
            elif a.get("action_type") == "omni_purchase":
                if purchases == 0:
                    purchases = int(a.get("value", 0))
        
        action_values = row.get("action_values", [])
        for av in action_values:
            if av.get("action_type") == "purchase":
                purchase_value = float(av.get("value", 0))
            elif av.get("action_type") == "omni_purchase":
                if purchase_value == 0:
                    purchase_value = float(av.get("value", 0))
        
        spend = float(row.get("spend", 0))
        roas = round(purchase_value / spend, 2) if spend > 0 else 0
        
        perf[cid] = {
            "impressions": int(row.get("impressions", 0)),
            "reach": int(row.get("reach", 0)),
            "clicks": int(row.get("clicks", 0)),
            "unique_clicks": int(row.get("unique_clicks", 0)),
            "ctr": float(row.get("ctr", 0)),
            "unique_ctr": float(row.get("unique_ctr", 0)),
            "cpc": float(row.get("cpc", 0)),
            "cpm": float(row.get("cpm", 0)),
            "spend": spend,
            "frequency": float(row.get("frequency", 0)),
            "purchases": purchases,
            "purchaseValue": purchase_value,
            "roas": roas
        }
        
        print(f"    {row.get('campaign_name', '?')[:45]}: RON {spend:.0f} spent, {purchases} purchases, ROAS {roas}", flush=True)
    
    return perf


# ===============================================
# 3. FETCH MONTHLY BREAKDOWN
# ===============================================
def fetch_monthly_insights():
    """Fetch monthly breakdown of spend, reach, purchases."""
    print("[3/4] Fetching monthly breakdown...", flush=True)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    insights = api_get(f"{AD_ACCOUNT_ID}/insights", {
        "fields": ",".join([
            "impressions", "reach", "clicks", "spend",
            "actions", "action_values"
        ]),
        "time_range": json.dumps({"since": START_DATE, "until": today}),
        "time_increment": "monthly",
        "limit": 100
    })
    
    month_names_ro = {
        "01": "Ian", "02": "Feb", "03": "Mar", "04": "Apr",
        "05": "Mai", "06": "Iun", "07": "Iul", "08": "Aug",
        "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
    }
    
    monthly = []
    for row in insights:
        date_start = row.get("date_start", "")
        y, m = date_start[:4], date_start[5:7]
        label = f"{month_names_ro.get(m, m)} {y}"
        
        spend = float(row.get("spend", 0))
        
        purchases = 0
        purchase_value = 0.0
        for a in row.get("actions", []):
            if a.get("action_type") in ["purchase", "omni_purchase"]:
                purchases += int(a.get("value", 0))
        for av in row.get("action_values", []):
            if av.get("action_type") in ["purchase", "omni_purchase"]:
                purchase_value += float(av.get("value", 0))
        
        roas = round(purchase_value / spend, 2) if spend > 0 else 0
        
        monthly.append({
            "month": label,
            "dateStart": date_start,
            "impressions": int(row.get("impressions", 0)),
            "reach": int(row.get("reach", 0)),
            "clicks": int(row.get("clicks", 0)),
            "spend": round(spend, 2),
            "purchases": purchases,
            "revenue": round(purchase_value, 2),
            "roas": roas
        })
        
        print(f"    {label}: spend RON {spend:,.0f} | rev RON {purchase_value:,.0f} | ROAS {roas}", flush=True)
    
    return monthly


# ===============================================
# 4. COMPOSE FINAL DATA
# ===============================================
def compose_data(campaigns, camp_perf, monthly):
    print("[4/4] Composing final data...", flush=True)
    
    campaigns_out = []
    total_spend = 0.0
    total_revenue = 0.0
    total_purchases = 0
    total_impressions = 0
    total_clicks = 0
    
    for c in campaigns:
        cid = c.get("id", "")
        perf = camp_perf.get(cid, {})
        
        spend = perf.get("spend", 0)
        revenue = perf.get("purchaseValue", 0)
        purchases = perf.get("purchases", 0)
        roas = perf.get("roas", 0)
        
        # ROAS rating
        if roas >= 3:
            rating = "excellent"
        elif roas >= 2:
            rating = "good"
        elif roas >= 1:
            rating = "acceptable"
        elif spend > 0:
            rating = "poor"
        else:
            rating = "no_data"
        
        camp_out = {
            "id": cid,
            "name": c.get("name", ""),
            "status": c.get("status", ""),
            "objective": c.get("objective", ""),
            "startTime": c.get("start_time", ""),
            "stopTime": c.get("stop_time", ""),
            "dailyBudget": float(c.get("daily_budget", 0)) / 100 if c.get("daily_budget") else 0,
            "lifetimeBudget": float(c.get("lifetime_budget", 0)) / 100 if c.get("lifetime_budget") else 0,
            "impressions": perf.get("impressions", 0),
            "reach": perf.get("reach", 0),
            "clicks": perf.get("clicks", 0),
            "ctr": round(perf.get("ctr", 0), 2),
            "cpc": round(perf.get("cpc", 0), 2),
            "cpm": round(perf.get("cpm", 0), 2),
            "frequency": round(perf.get("frequency", 0), 2),
            "spend": round(spend, 2),
            "purchases": purchases,
            "purchaseValue": round(revenue, 2),
            "roas": roas,
            "performanceRating": rating
        }
        campaigns_out.append(camp_out)
        
        total_spend += spend
        total_revenue += revenue
        total_purchases += purchases
        total_impressions += perf.get("impressions", 0)
        total_clicks += perf.get("clicks", 0)
    
    # Sort by spend desc
    campaigns_out.sort(key=lambda x: x["spend"], reverse=True)
    
    overall_roas = round(total_revenue / total_spend, 2) if total_spend > 0 else 0
    overall_ctr = round((total_clicks / total_impressions) * 100, 2) if total_impressions > 0 else 0
    overall_cpc = round(total_spend / total_clicks, 2) if total_clicks > 0 else 0
    overall_cpa = round(total_spend / total_purchases, 2) if total_purchases > 0 else 0
    
    data = {
        "lastUpdated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "currency": "RON",
        "adAccountId": AD_ACCOUNT_ID,
        "adAccountName": "ZitamineAds",
        "period": f"{START_DATE} to {datetime.now().strftime('%Y-%m-%d')}",
        "summary": {
            "totalSpend": round(total_spend, 2),
            "totalRevenue": round(total_revenue, 2),
            "totalPurchases": total_purchases,
            "totalImpressions": total_impressions,
            "totalClicks": total_clicks,
            "roas": overall_roas,
            "ctr": overall_ctr,
            "cpc": overall_cpc,
            "cpa": overall_cpa,
            "activeCampaigns": len([c for c in campaigns_out if c["status"] == "ACTIVE"]),
            "pausedCampaigns": len([c for c in campaigns_out if c["status"] == "PAUSED"]),
            "totalCampaigns": len(campaigns_out)
        },
        "monthlyTrend": monthly,
        "campaigns": campaigns_out
    }
    
    return data


# ===============================================
# MAIN
# ===============================================
def main():
    print("=" * 50, flush=True)
    print("  META ADS DATA FETCHER - Antigravity", flush=True)
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}", flush=True)
    print(f"  Account: {AD_ACCOUNT_ID}", flush=True)
    print("=" * 50, flush=True)
    
    # 1. Campaigns
    campaigns = fetch_campaigns()
    
    # 2. Campaign insights
    camp_perf = fetch_campaign_insights()
    
    # 3. Monthly breakdown
    monthly = fetch_monthly_insights()
    
    # 4. Compose & save
    data = compose_data(campaigns, camp_perf, monthly)
    
    json_path = os.path.join(SCRIPT_DIR, "meta_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Summary
    s = data["summary"]
    print("", flush=True)
    print("=" * 50, flush=True)
    print("  RESULTS", flush=True)
    print("=" * 50, flush=True)
    print(f"  Campaigns:    {s['totalCampaigns']} ({s['activeCampaigns']} active, {s['pausedCampaigns']} paused)", flush=True)
    print(f"  Total Spend:  RON {s['totalSpend']:,.2f}", flush=True)
    print(f"  Total Revenue:RON {s['totalRevenue']:,.2f}", flush=True)
    print(f"  Purchases:    {s['totalPurchases']}", flush=True)
    print(f"  ROAS:         {s['roas']}x", flush=True)
    print(f"  CTR:          {s['ctr']}%", flush=True)
    print(f"  CPC:          RON {s['cpc']}", flush=True)
    print(f"  CPA:          RON {s['cpa']}", flush=True)
    
    if data["campaigns"]:
        print(f"\n  Top Campaigns by Spend:", flush=True)
        for cp in data["campaigns"][:5]:
            print(f"    {cp['name'][:45]}: RON {cp['spend']:,.0f} | ROAS {cp['roas']}x", flush=True)
    
    if data["monthlyTrend"]:
        print(f"\n  Monthly Trend:", flush=True)
        for m in data["monthlyTrend"]:
            print(f"    {m['month']}: spend RON {m['spend']:,.0f} | rev RON {m['revenue']:,.0f} | ROAS {m['roas']}x", flush=True)
    
    print(f"\n  Saved: {json_path}", flush=True)
    print("  DONE!", flush=True)


if __name__ == "__main__":
    main()
