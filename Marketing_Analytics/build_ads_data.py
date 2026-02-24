#!/usr/bin/env python3
"""
build_ads_data.py  — Merge meta_data.json + google_data.json + klaviyo_data.json → ads_data.js
Generates the JavaScript data file consumed by Marketing_Analytics.html
Includes real Klaviyo billing costs from invoices.
"""

import json, os, sys
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Klaviyo monthly costs (USD) — from Klaviyo billing invoices
# Converted to RON at approximate exchange rate
USD_TO_RON = 4.7  # approximate average rate for the period

KLAVIYO_MONTHLY_COSTS_USD = {
    'Ian 2025': 400,
    'Feb 2025': 400,
    'Mar 2025': 500,
    'Apr 2025': 570,
    'Mai 2025': 570,
    'Iun 2025': 570,
    'Iul 2025': 640,
    'Aug 2025': 640,
    'Sep 2025': 640,
    'Oct 2025': 640,
    'Nov 2025': 1490,   # plan changes + overage
    'Dec 2025': 570,
    'Ian 2026': 570,
    'Feb 2026': 570,
}

def load_json(fname):
    path = os.path.join(SCRIPT_DIR, fname)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def safe(v, default=0):
    """Return numeric value or default."""
    if v is None:
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default

def build_meta_section(data):
    """Build meta ads section from meta_data.json."""
    s = data.get('summary', {})
    
    monthly = []
    for m in data.get('monthlyTrend', []):
        monthly.append({
            'month': m['month'],
            'spend': round(safe(m.get('spend')), 2),
            'revenue': round(safe(m.get('revenue')), 2),
            'roas': round(safe(m.get('roas')), 2),
            'purchases': int(safe(m.get('purchases'))),
            'impressions': int(safe(m.get('impressions'))),
            'reach': int(safe(m.get('reach'))),
            'clicks': int(safe(m.get('clicks'))),
        })
    
    # Sort campaigns by spend descending, take top 30
    raw_campaigns = data.get('campaigns', [])
    raw_campaigns.sort(key=lambda c: safe(c.get('spend')), reverse=True)
    top_campaigns = raw_campaigns[:30]
    
    campaigns = []
    for c in top_campaigns:
        campaigns.append({
            'id': c.get('id', ''),
            'name': c.get('name', ''),
            'status': c.get('status', 'PAUSED'),
            'objective': c.get('objective', ''),
            'startTime': c.get('startTime', ''),
            'dailyBudget': safe(c.get('dailyBudget')),
            'spend': round(safe(c.get('spend')), 2),
            'reach': int(safe(c.get('reach'))),
            'impressions': int(safe(c.get('impressions'))),
            'clicks': int(safe(c.get('clicks'))),
            'ctr': round(safe(c.get('ctr')), 2),
            'cpm': round(safe(c.get('cpm')), 2),
            'cpc': round(safe(c.get('cpc')), 2),
            'frequency': round(safe(c.get('frequency')), 2),
            'purchases': int(safe(c.get('purchases'))),
            'purchaseValue': round(safe(c.get('purchaseValue')), 2),
            'roas': round(safe(c.get('roas')), 2),
            'performanceRating': c.get('performanceRating', 'acceptable'),
        })
    
    return {
        'lastUpdated': data.get('lastUpdated', ''),
        'currency': 'RON',
        'adAccountName': data.get('adAccountName', 'ZitamineAds'),
        'summary': {
            'totalSpend': round(safe(s.get('totalSpend')), 2),
            'totalRevenue': round(safe(s.get('totalRevenue')), 2),
            'roas': round(safe(s.get('roas')), 2),
            'totalImpressions': int(safe(s.get('totalImpressions'))),
            'totalClicks': int(safe(s.get('totalClicks'))),
            'avgCTR': round(safe(s.get('ctr')), 2),
            'avgCPM': round(safe(s.get('totalSpend')) / max(safe(s.get('totalImpressions')), 1) * 1000, 2),
            'avgCPC': round(safe(s.get('cpc')), 2),
            'totalPurchases': int(safe(s.get('totalPurchases'))),
            'cpa': round(safe(s.get('cpa')), 2),
            'activeCampaigns': int(safe(s.get('activeCampaigns'))),
            'pausedCampaigns': int(safe(s.get('pausedCampaigns'))),
            'totalCampaigns': int(safe(s.get('totalCampaigns'))),
        },
        'monthlyTrend': monthly,
        'campaigns': campaigns,
    }

def build_google_section(data):
    """Build google ads section from google_data.json."""
    s = data.get('summary', {})
    
    monthly = []
    for m in data.get('monthlyTrend', []):
        monthly.append({
            'month': m['month'],
            'spend': round(safe(m.get('cost')), 2),
            'revenue': round(safe(m.get('conversionValue')), 2),
            'roas': round(safe(m.get('roas')), 2),
            'conversions': round(safe(m.get('conversions')), 0),
        })
    
    # Sort campaigns by cost descending, take top 30
    raw_campaigns = data.get('campaigns', [])
    raw_campaigns.sort(key=lambda c: safe(c.get('cost')), reverse=True)
    top_campaigns = raw_campaigns[:30]
    
    campaigns = []
    for c in top_campaigns:
        campaigns.append({
            'id': c.get('id', ''),
            'name': c.get('name', ''),
            'status': c.get('status', 'PAUSED'),
            'type': c.get('type', ''),
            'spend': round(safe(c.get('cost')), 2),
            'impressions': int(safe(c.get('impressions'))),
            'clicks': int(safe(c.get('clicks'))),
            'ctr': round(safe(c.get('ctr')), 2),
            'avgCPC': round(safe(c.get('avgCpc')), 2),
            'avgCPM': round(safe(c.get('avgCpm')), 2),
            'conversions': round(safe(c.get('conversions')), 2),
            'conversionValue': round(safe(c.get('conversionValue')), 2),
            'roas': round(safe(c.get('roas')), 2),
            'cpa': round(safe(c.get('cpa')), 2),
            'performanceRating': c.get('performanceRating', 'acceptable'),
        })
    
    return {
        'lastUpdated': data.get('lastUpdated', ''),
        'currency': 'RON',
        'summary': {
            'totalSpend': round(safe(s.get('totalSpend')), 2),
            'totalRevenue': round(safe(s.get('totalRevenue')), 2),
            'roas': round(safe(s.get('roas')), 2),
            'totalImpressions': int(safe(s.get('totalImpressions'))),
            'totalClicks': int(safe(s.get('totalClicks'))),
            'avgCTR': round(safe(s.get('ctr')), 2),
            'avgCPC': round(safe(s.get('cpc')), 2),
            'totalConversions': round(safe(s.get('totalConversions')), 0),
            'cpa': round(safe(s.get('cpa')), 2),
            'enabledCampaigns': int(safe(s.get('enabledCampaigns'))),
            'pausedCampaigns': int(safe(s.get('pausedCampaigns'))),
            'totalCampaigns': int(safe(s.get('totalCampaigns'))),
        },
        'monthlyTrend': monthly,
        'campaigns': campaigns,
    }

def build_klaviyo_section(data):
    """Build klaviyo section from klaviyo_data.json."""
    s = data.get('summary', {})
    
    # Calculate total Klaviyo cost
    total_cost_usd = sum(KLAVIYO_MONTHLY_COSTS_USD.values())
    total_cost_ron = round(total_cost_usd * USD_TO_RON, 2)
    
    monthly = []
    for m in data.get('monthlyTrend', []):
        month_name = m['month']
        cost_usd = KLAVIYO_MONTHLY_COSTS_USD.get(month_name, 0)
        cost_ron = round(cost_usd * USD_TO_RON, 2)
        monthly.append({
            'month': month_name,
            'sends': int(safe(m.get('sends'))),
            'revenue': round(safe(m.get('revenue')), 2),
            'campaigns': int(safe(m.get('campaigns'))),
            'spend': cost_ron,
        })
    
    # Flows
    flows = []
    for f in data.get('flows', []):
        flows.append({
            'id': f.get('id', ''),
            'name': f.get('name', ''),
            'status': f.get('status', ''),
            'triggerType': f.get('trigger', ''),
            'sends': int(safe(f.get('recipients'))),
            'openRate': round(safe(f.get('openRate')), 1),
            'clickRate': round(safe(f.get('clickRate')), 1),
            'revenue': round(safe(f.get('revenue')), 2),
            'rpe': round(safe(f.get('revenue')) / max(int(safe(f.get('recipients'))), 1), 2),
            'performanceRating': _klaviyo_rating(f),
        })
    
    # Sort flows by revenue descending
    flows.sort(key=lambda f: f['revenue'], reverse=True)
    
    # Campaigns - top 20 by revenue
    raw_campaigns = data.get('campaigns', [])
    raw_campaigns.sort(key=lambda c: safe(c.get('revenue')), reverse=True)
    top_campaigns = raw_campaigns[:20]
    
    campaigns = []
    for c in top_campaigns:
        sends = int(safe(c.get('recipients', c.get('sends'))))
        opens = int(safe(c.get('opens')))
        clicks = int(safe(c.get('clicks')))
        revenue = round(safe(c.get('revenue')), 2)
        campaigns.append({
            'id': c.get('id', ''),
            'name': c.get('name', ''),
            'sentDate': c.get('sendDate', c.get('sentDate', '')),
            'sends': sends,
            'opens': opens,
            'openRate': round(safe(c.get('openRate')), 1),
            'clicks': clicks,
            'clickRate': round(safe(c.get('clickRate')), 1),
            'revenue': revenue,
            'rpe': round(revenue / max(sends, 1), 2),
            'subjectLine': c.get('subject', c.get('subjectLine', '')),
            'performanceRating': _klaviyo_campaign_rating(c),
        })
    
    return {
        'lastUpdated': data.get('lastUpdated', ''),
        'currency': 'RON',
        'summary': {
            'totalRevenue': round(safe(s.get('totalRevenue')), 2),
            'flowRevenue': round(safe(s.get('flowRevenue')), 2),
            'campaignRevenue': round(safe(s.get('campaignRevenue')), 2),
            'totalSends': int(safe(s.get('totalSends'))),
            'activeFlows': int(safe(s.get('activeFlows'))),
            'sentCampaigns': int(safe(s.get('sentCampaigns'))),
            'totalSpend': total_cost_ron,
            'monthlyAvgCost': round(total_cost_ron / len(KLAVIYO_MONTHLY_COSTS_USD), 2),
        },
        'monthlyTrend': monthly,
        'flows': flows,
        'campaigns': campaigns,
    }

def _klaviyo_rating(f):
    rev = safe(f.get('revenue'))
    recipients = safe(f.get('recipients'))
    if recipients == 0:
        return 'acceptable'
    rpe = rev / recipients
    if rpe >= 1.5:
        return 'excellent'
    elif rpe >= 0.8:
        return 'good'
    elif rpe >= 0.3:
        return 'acceptable'
    return 'poor'

def _klaviyo_campaign_rating(c):
    rev = safe(c.get('revenue'))
    sends = safe(c.get('recipients', c.get('sends')))
    if sends == 0:
        return 'acceptable'
    rpe = rev / sends
    if rpe >= 1.0:
        return 'excellent'
    elif rpe >= 0.4:
        return 'good'
    elif rpe >= 0.1:
        return 'acceptable'
    return 'poor'

def build_overview(meta, google, klaviyo):
    """Build the cross-channel overview."""
    meta_spend = meta['summary']['totalSpend']
    meta_rev = meta['summary']['totalRevenue']
    google_spend = google['summary']['totalSpend']
    google_rev = google['summary']['totalRevenue']
    klaviyo_spend = klaviyo['summary']['totalSpend']
    klaviyo_rev = klaviyo['summary']['totalRevenue']
    
    total_spend = meta_spend + google_spend + klaviyo_spend
    total_rev = meta_rev + google_rev + klaviyo_rev
    total_ad_rev = meta_rev + google_rev
    blended_roas = round(total_ad_rev / max(meta_spend + google_spend, 1), 2)
    
    # Determine best channels
    channels = [
        ('Meta Ads', meta_spend, meta_rev, meta['summary']['roas']),
        ('Google Ads', google_spend, google_rev, google['summary']['roas']),
    ]
    best_roas = max(channels, key=lambda x: x[3])
    best_volume = max(channels, key=lambda x: x[2])
    
    # Klaviyo ROAS
    klaviyo_roas = round(klaviyo_rev / max(klaviyo_spend, 1), 2) if klaviyo_spend > 0 else None
    
    # Generate insights
    insights = [
        f"ROAS blended de {blended_roas}x pe ads — {'peste' if blended_roas >= 2 else 'sub'} pragul de 2x",
        f"{best_roas[0]} are cel mai bun ROAS ({best_roas[3]}x)",
        f"{best_volume[0]} generează cel mai mult volum de vânzări ({best_volume[2]:,.0f} RON)",
        f"Klaviyo generează {klaviyo_rev:,.0f} RON revenue cu un cost de {klaviyo_spend:,.0f} RON ({klaviyo_roas}x ROAS)" if klaviyo_roas else f"Klaviyo generează {klaviyo_rev:,.0f} RON revenue",
        f"Total revenue generat din toate canalele: {total_rev:,.0f} RON",
        f"Total spend pe toate canalele: {total_spend:,.0f} RON",
    ]
    
    return {
        'totalAdSpend': round(meta_spend + google_spend, 2),
        'totalSpendAll': round(total_spend, 2),
        'totalAdRevenue': round(total_ad_rev, 2),
        'totalRevenue': round(total_rev, 2),
        'blendedROAS': blended_roas,
        'reportPeriod': {'start': '2025-01-01', 'end': datetime.now().strftime('%Y-%m-%d')},
        'channelMix': [
            {'channel': 'Meta Ads', 'spend': meta_spend, 'revenue': meta_rev, 'roas': meta['summary']['roas'], 'color': '#1877F2'},
            {'channel': 'Google Ads', 'spend': google_spend, 'revenue': google_rev, 'roas': google['summary']['roas'], 'color': '#EA4335'},
            {'channel': 'Klaviyo Email', 'spend': klaviyo_spend, 'revenue': klaviyo_rev, 'roas': klaviyo_roas, 'color': '#ED8936'},
        ],
        'bestROASChannel': best_roas[0],
        'bestVolumeChannel': best_volume[0],
        'topInsights': insights,
    }

def main():
    print("=" * 50)
    print("  BUILD ADS_DATA.JS — Real Data")
    print("=" * 50)
    
    # Load JSON files
    meta_raw = load_json('meta_data.json')
    google_raw = load_json('google_data.json')
    klaviyo_raw = load_json('klaviyo_data.json')
    
    # Build sections
    meta = build_meta_section(meta_raw)
    google = build_google_section(google_raw)
    klaviyo = build_klaviyo_section(klaviyo_raw)
    overview = build_overview(meta, google, klaviyo)
    
    # Build full data object
    ads_data = {
        'meta': meta,
        'google': google,
        'klaviyo': klaviyo,
        'overview': overview,
    }
    
    # Generate JS file
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    js_content = f"""// ============================================================
// MARKETING ANALYTICS DATA — ANTIGRAVITY / ZITAMINE
// Generated: {now} | Source: Real API Data
// Auto-generated by build_ads_data.py — DO NOT EDIT MANUALLY
// ============================================================

const ADS_DATA = {json.dumps(ads_data, indent=4, ensure_ascii=False, default=str)};

// Utility functions
function formatRON(value) {{
    return new Intl.NumberFormat('ro-RO', {{ style: 'currency', currency: 'RON', maximumFractionDigits: 0 }}).format(value);
}}

function formatNumber(n) {{
    return new Intl.NumberFormat('ro-RO').format(n);
}}

function formatPercent(n, decimals = 1) {{
    return n.toFixed(decimals) + '%';
}}

function getROASClass(roas) {{
    if (!roas) return 'neutral';
    if (roas >= 3.5) return 'excellent';
    if (roas >= 2.5) return 'good';
    if (roas >= 2.0) return 'acceptable';
    return 'poor';
}}

function getROASBadgeColor(roas) {{
    if (!roas) return '#6b7280';
    if (roas >= 3.5) return '#10b981';
    if (roas >= 2.5) return '#f59e0b';
    if (roas >= 2.0) return '#f97316';
    return '#ef4444';
}}

function getStatusBadge(status) {{
    const map = {{
        'ACTIVE': {{ label: 'Activ', color: '#10b981' }},
        'ENABLED': {{ label: 'Activ', color: '#10b981' }},
        'PAUSED': {{ label: 'Pauzat', color: '#f59e0b' }},
        'ENDED': {{ label: 'Finalizat', color: '#6b7280' }},
        'LIVE': {{ label: 'Live', color: '#10b981' }},
        'DRAFT': {{ label: 'Draft', color: '#6b7280' }},
        'MANUAL': {{ label: 'Manual', color: '#6b7280' }},
    }};
    return map[status] || {{ label: status, color: '#6b7280' }};
}}
"""
    
    output_path = os.path.join(SCRIPT_DIR, 'ads_data.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    # Print summary
    klav_cost = klaviyo['summary']['totalSpend']
    print(f"\n  Meta Ads:    {meta['summary']['totalSpend']:>12,.2f} RON spend | {meta['summary']['totalRevenue']:>12,.2f} RON rev | ROAS {meta['summary']['roas']}x | {len(meta['campaigns'])} campaigns")
    print(f"  Google Ads:  {google['summary']['totalSpend']:>12,.2f} RON spend | {google['summary']['totalRevenue']:>12,.2f} RON rev | ROAS {google['summary']['roas']}x | {len(google['campaigns'])} campaigns")
    print(f"  Klaviyo:     {klav_cost:>12,.2f} RON spend | {klaviyo['summary']['totalRevenue']:>12,.2f} RON rev | {len(klaviyo['flows'])} flows, {len(klaviyo['campaigns'])} campaigns")
    print(f"\n  TOTAL SPEND: {overview['totalSpendAll']:>12,.2f} RON")
    print(f"  TOTAL REV:   {overview['totalRevenue']:>12,.2f} RON")
    print(f"  BLENDED ROAS:{overview['blendedROAS']:>8}x")
    print(f"\n  Saved: {output_path}")
    print(f"  Size: {os.path.getsize(output_path) / 1024:.1f} KB")
    print("  DONE!")

if __name__ == '__main__':
    main()
