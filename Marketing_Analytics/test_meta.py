"""Discover Zitamine business ad accounts via Meta API."""
import requests
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ACCESS_TOKEN = "EAAZB7coPkGZBABQ2G0v6buNsREHUxBrZAZBV3VAV6nNgZCmP25AeQ2OXEWTv5f1VF3ZAhHs2IbDunVcNWXrqizy1ZCWiZCqmL9WnRIFpa1sJB0wD0lepa9jz9ZAeUNVyPewArEyAyZCVNMeb6a2ogY8cgbPg3o4mxa75vppteCuDpjqU5bK2cLymVE9dWZAhlKNWfYDXFZAr1bRe"
BASE = "https://graph.facebook.com/v21.0"

# 1. List all businesses the user has access to
print("1. Listing businesses...", flush=True)
resp = requests.get(f"{BASE}/me/businesses", params={
    "access_token": ACCESS_TOKEN,
    "fields": "name,id"
})
print(f"   Status: {resp.status_code}", flush=True)
if resp.status_code == 200:
    businesses = resp.json().get("data", [])
    print(f"   Found {len(businesses)} business(es):", flush=True)
    for b in businesses:
        print(f"     - {b.get('name', '?')} (ID: {b.get('id', '?')})", flush=True)
        
        # Get ad accounts for each business
        print(f"\n2. Ad accounts for business '{b.get('name')}'...", flush=True)
        resp2 = requests.get(f"{BASE}/{b['id']}/owned_ad_accounts", params={
            "access_token": ACCESS_TOKEN,
            "fields": "name,account_id,account_status,currency,amount_spent,balance",
            "limit": 25
        })
        print(f"   Status: {resp2.status_code}", flush=True)
        if resp2.status_code == 200:
            accounts = resp2.json().get("data", [])
            print(f"   Found {len(accounts)} ad account(s):", flush=True)
            for acc in accounts:
                status_map = {1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED", 7: "PENDING_RISK_REVIEW", 8: "PENDING_SETTLEMENT", 9: "IN_GRACE_PERIOD", 100: "PENDING_CLOSURE", 101: "CLOSED"}
                st = status_map.get(acc.get('account_status', 0), str(acc.get('account_status', '?')))
                spent = int(acc.get('amount_spent', '0')) / 100  # Amount in cents
                print(f"     - {acc.get('name', '?')}", flush=True)
                print(f"       ID: {acc.get('id', '?')}", flush=True)
                print(f"       Status: {st}, Currency: {acc.get('currency', '?')}", flush=True)
                print(f"       Amount spent: {spent:,.2f}", flush=True)
                
                # Quick campaign count
                resp3 = requests.get(f"{BASE}/{acc['id']}/campaigns", params={
                    "access_token": ACCESS_TOKEN,
                    "fields": "name,status",
                    "limit": 5
                })
                if resp3.status_code == 200:
                    camps = resp3.json().get("data", [])
                    print(f"       Campaigns (first 5): {len(camps)}", flush=True)
                    for c in camps:
                        print(f"         - {c.get('name','?')} ({c.get('status','?')})", flush=True)
                else:
                    print(f"       Campaign error: {resp3.status_code} - {resp3.text[:200]}", flush=True)
        else:
            # Try client ad accounts
            print(f"   Trying client_ad_accounts...", flush=True)
            resp2b = requests.get(f"{BASE}/{b['id']}/client_ad_accounts", params={
                "access_token": ACCESS_TOKEN,
                "fields": "name,account_id,account_status,currency,amount_spent",
                "limit": 25
            })
            print(f"   Status: {resp2b.status_code}", flush=True)
            print(f"   Response: {resp2b.text[:500]}", flush=True)
else:
    print(f"   Error: {resp.text[:500]}", flush=True)
    print("\n   Trying alternate: /me/adaccounts with business...", flush=True)

print("\nDONE!", flush=True)
