"""
Extract GA4 traffic sources by month for 2026 (Jan, Feb, Mar, Apr).
For each month: channel groups, top sources, and key metrics.
"""
import os, json, logging
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Metric, Dimension, OrderBy,
)

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

PROPERTY_ID = "297495831"
SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(SCRIPT_DIR, 'ga4_token.json')
CREDENTIALS_FILE = os.path.join(SCRIPT_DIR, 'credentials.json')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'ga4_monthly_traffic_2026.json')

MONTHS = [
    {"name": "Ianuarie 2026", "start": "2026-01-01", "end": "2026-01-31"},
    {"name": "Februarie 2026", "start": "2026-02-01", "end": "2026-02-28"},
    {"name": "Martie 2026", "start": "2026-03-01", "end": "2026-03-31"},
    {"name": "Aprilie 2026", "start": "2026-04-01", "end": "2026-04-14"},
]

def get_credentials():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as f:
            f.write(creds.to_json())
    return creds

def run_report(client, dims, mets, dr, limit=30):
    resp = client.run_report(RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=dr,
        dimensions=[Dimension(name=d) for d in dims],
        metrics=[Metric(name=m) for m in mets],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=limit,
    ))
    rows = []
    for row in resp.rows:
        r = {}
        for i, d in enumerate(dims):
            r[d] = row.dimension_values[i].value
        for i, m in enumerate(mets):
            v = row.metric_values[i].value
            try:
                r[m] = round(float(v), 2) if '.' in v else int(v)
            except:
                r[m] = v
        rows.append(r)
    return rows

def fetch_month(client, month):
    dr = [DateRange(start_date=month["start"], end_date=month["end"])]
    mets = ["sessions", "activeUsers", "totalRevenue", "conversions", "engagedSessions", "bounceRate"]

    logging.info(f"  {month['name']} — channels...")
    channels = run_report(client, ["sessionDefaultChannelGroup"], mets, dr)

    logging.info(f"  {month['name']} — source/medium...")
    sources = run_report(client, ["sessionSource", "sessionMedium"], mets, dr, 15)

    logging.info(f"  {month['name']} — campaigns...")
    campaigns = run_report(client, ["sessionCampaignName", "sessionSource"],
        ["sessions", "activeUsers", "totalRevenue", "conversions"], dr, 15)

    logging.info(f"  {month['name']} — totals...")
    totals = run_report(client, [],
        ["sessions", "activeUsers", "totalRevenue", "conversions", "engagedSessions",
         "averageSessionDuration", "bounceRate", "screenPageViews"], dr)

    return {
        "name": month["name"],
        "period": f"{month['start']} to {month['end']}",
        "channels": channels,
        "sources": sources,
        "campaigns": campaigns,
        "totals": totals[0] if totals else {},
    }

if __name__ == '__main__':
    logging.info("Extracting monthly traffic data for 2026...")
    creds = get_credentials()
    client = BetaAnalyticsDataClient(credentials=creds)

    data = {"months": []}
    for m in MONTHS:
        data["months"].append(fetch_month(client, m))

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logging.info(f"\nSaved to {OUTPUT_FILE}")
    for m in data["months"]:
        t = m["totals"]
        print(f"  {m['name']}: {t.get('activeUsers','?')} users | {t.get('sessions','?')} ses | {t.get('totalRevenue','?')} RON")
