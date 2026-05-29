"""
Fetch GA4 Customer Profile Data for Zitamine — 2025 + 2026
Extrage: demografie, surse de trafic, device, geo, engagement
Perioade: 2025 full year + 2026 YTD
"""

import os
import sys
import json
import logging
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest,
    DateRange,
    Metric,
    Dimension,
    OrderBy,
)

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

PROPERTY_ID = "297495831"
SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(SCRIPT_DIR, 'credentials.json')
TOKEN_FILE = os.path.join(SCRIPT_DIR, 'ga4_token.json')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'ga4_customer_profile.json')

DATE_2026_START = "2026-01-01"
DATE_2026_END = "today"
DATE_2025_START = "2025-01-01"
DATE_2025_END = "2025-12-31"


def get_credentials():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logging.info("Refreshing expired GA4 token...")
            creds.refresh(Request())
        else:
            logging.info("Starting OAuth2 flow for GA4 Data API...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    return creds


def run_report(client, dimensions, metrics, date_ranges, order_by=None, limit=50):
    dim_objects = [Dimension(name=d) for d in dimensions] if dimensions else []
    met_objects = [Metric(name=m) for m in metrics]
    request = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=date_ranges,
        dimensions=dim_objects,
        metrics=met_objects,
        limit=limit,
    )
    if order_by:
        request.order_bys = order_by
    response = client.run_report(request)
    rows = []
    for row in response.rows:
        row_data = {}
        for i, dim in enumerate(dimensions):
            row_data[dim] = row.dimension_values[i].value
        for i, met in enumerate(metrics):
            val = row.metric_values[i].value
            try:
                if '.' in val:
                    row_data[met] = round(float(val), 2)
                else:
                    row_data[met] = int(val)
            except ValueError:
                row_data[met] = val
        rows.append(row_data)
    return rows


def fetch_for_period(client, dr, period_name):
    """Fetch all report sections for a given date range."""
    result = {}
    standard_order = [OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True)]
    session_order = [OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)]

    logging.info(f"  [{period_name}] Varsta...")
    try:
        result["demographics_age"] = run_report(client, ["userAgeBracket"],
            ["activeUsers","sessions","totalRevenue","conversions"], dr, standard_order)
    except Exception as e:
        logging.warning(f"    Age error: {e}"); result["demographics_age"] = []

    logging.info(f"  [{period_name}] Gen...")
    try:
        result["demographics_gender"] = run_report(client, ["userGender"],
            ["activeUsers","sessions","totalRevenue","conversions"], dr, standard_order)
    except Exception as e:
        logging.warning(f"    Gender error: {e}"); result["demographics_gender"] = []

    logging.info(f"  [{period_name}] Orase...")
    try:
        result["geo_city"] = run_report(client, ["city"],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions"], dr, standard_order, 30)
    except Exception as e:
        logging.warning(f"    City error: {e}"); result["geo_city"] = []

    logging.info(f"  [{period_name}] Tari...")
    try:
        result["geo_country"] = run_report(client, ["country"],
            ["activeUsers","sessions","totalRevenue","conversions"], dr, standard_order, 20)
    except Exception as e:
        logging.warning(f"    Country error: {e}"); result["geo_country"] = []

    logging.info(f"  [{period_name}] Source/Medium...")
    try:
        result["traffic_source_medium"] = run_report(client, ["sessionSource","sessionMedium"],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions","bounceRate"], dr, session_order, 30)
    except Exception as e:
        logging.warning(f"    Source error: {e}"); result["traffic_source_medium"] = []

    logging.info(f"  [{period_name}] Channel Groups...")
    try:
        result["traffic_channel_group"] = run_report(client, ["sessionDefaultChannelGroup"],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions","averageSessionDuration","bounceRate"], dr, session_order)
    except Exception as e:
        logging.warning(f"    Channel error: {e}"); result["traffic_channel_group"] = []

    logging.info(f"  [{period_name}] Campanii...")
    try:
        result["traffic_campaigns"] = run_report(client, ["sessionCampaignName","sessionSource"],
            ["activeUsers","sessions","totalRevenue","conversions"], dr, session_order, 30)
    except Exception as e:
        logging.warning(f"    Campaign error: {e}"); result["traffic_campaigns"] = []

    logging.info(f"  [{period_name}] Device...")
    try:
        result["device_category"] = run_report(client, ["deviceCategory"],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions","averageSessionDuration","bounceRate"], dr, session_order)
    except Exception as e:
        logging.warning(f"    Device error: {e}"); result["device_category"] = []

    logging.info(f"  [{period_name}] New vs Returning...")
    try:
        result["new_vs_returning"] = run_report(client, ["newVsReturning"],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions","averageSessionDuration"], dr, session_order)
    except Exception as e:
        logging.warning(f"    NvR error: {e}"); result["new_vs_returning"] = []

    logging.info(f"  [{period_name}] Limba...")
    try:
        result["language"] = run_report(client, ["language"],
            ["activeUsers","sessions"], dr, standard_order, 15)
    except Exception as e:
        logging.warning(f"    Language error: {e}"); result["language"] = []

    logging.info(f"  [{period_name}] First User Source...")
    try:
        result["first_user_source"] = run_report(client, ["firstUserSource","firstUserMedium"],
            ["activeUsers","sessions","totalRevenue","conversions"], dr, standard_order, 25)
    except Exception as e:
        logging.warning(f"    First source error: {e}"); result["first_user_source"] = []

    logging.info(f"  [{period_name}] Landing Pages...")
    try:
        result["top_landing_pages"] = run_report(client, ["landingPagePlusQueryString"],
            ["activeUsers","sessions","totalRevenue","conversions","bounceRate"], dr, session_order, 20)
    except Exception as e:
        logging.warning(f"    Landing error: {e}"); result["top_landing_pages"] = []

    logging.info(f"  [{period_name}] Totals...")
    try:
        totals = run_report(client, [],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions","averageSessionDuration","bounceRate","screenPageViews"], dr)
        result["totals"] = totals[0] if totals else {}
    except Exception as e:
        logging.warning(f"    Totals error: {e}"); result["totals"] = {}

    return result


def fetch_all():
    creds = get_credentials()
    client = BetaAnalyticsDataClient(credentials=creds)
    dr_2025 = [DateRange(start_date=DATE_2025_START, end_date=DATE_2025_END)]
    dr_2026 = [DateRange(start_date=DATE_2026_START, end_date=DATE_2026_END)]

    data = {
        "propertyId": PROPERTY_ID,
        "extractedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "periods": {
            "2025": f"{DATE_2025_START} to {DATE_2025_END}",
            "2026": f"{DATE_2026_START} to today",
        }
    }

    # Monthly trend 2025+2026
    logging.info("Trend lunar 2025-2026...")
    try:
        dr_all = [DateRange(start_date=DATE_2025_START, end_date=DATE_2026_END)]
        data["monthly_trend"] = run_report(client, ["yearMonth"],
            ["activeUsers","sessions","totalRevenue","conversions","engagedSessions","screenPageViews","bounceRate"],
            dr_all,
            [OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="yearMonth"), desc=False)],
            30)
    except Exception as e:
        logging.warning(f"Monthly trend error: {e}"); data["monthly_trend"] = []

    logging.info("=== Extracting 2025 data ===")
    data["y2025"] = fetch_for_period(client, dr_2025, "2025")

    logging.info("=== Extracting 2026 data ===")
    data["y2026"] = fetch_for_period(client, dr_2026, "2026")

    return data


if __name__ == '__main__':
    logging.info("Starting GA4 extraction: 2025 + 2026...")
    data = fetch_all()
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    logging.info(f"Saved to {OUTPUT_FILE}")

    t25 = data["y2025"].get("totals", {})
    t26 = data["y2026"].get("totals", {})
    print("\n" + "=" * 50)
    print("  GA4 DATA EXTRACTED SUCCESSFULLY")
    print("=" * 50)
    print(f"  2025: {t25.get('activeUsers','?')} users | {t25.get('sessions','?')} sessions | {t25.get('totalRevenue','?')} RON")
    print(f"  2026: {t26.get('activeUsers','?')} users | {t26.get('sessions','?')} sessions | {t26.get('totalRevenue','?')} RON")
    print(f"  Saved: {OUTPUT_FILE}")
    print("=" * 50)
