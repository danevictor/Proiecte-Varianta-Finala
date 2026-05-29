# Ghid Surse de Date pentru Rapoarte & Dashboards

Acest document explică de unde provin datele pentru fiecare raport HTML și prin ce scripturi sunt procesate.

## 1. Raport Vânzări 2024-2026 (`Raport_Vanzari_2024_2026.html`)
- **Sursă Date**: API-ul Shopify.
- **Fișiere intermediare**: Se descarcă local în `master_orders.csv` (cache) pentru a nu suprasolicita API-ul.
- **Script de procesare**: `process_sales_data.ps1`
- **Output vizualizare**: Scriptul de mai sus generează fișierul `dashboard_data.js` (și `sales_data_2024_2025.js`), care este citit direct de HTML.
- **Locație**: `Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\`

## 2. Dashboard Zitamine (`Zitamine_Sales_Dashboard.html`)
- **Sursă Date**: Același API Shopify descris la punctul 1. Acesta este un dashboard secundar bazat pe aceleași date de vânzări și profitabilitate.
- **Fișiere intermediare**: Se bazează complet pe `dashboard_data.js`.
- **Script de procesare**:  Același script de PowerShell `process_sales_data.ps1` copiază automat varianta nouă de `dashboard_data.js` și în folderul `DASHBOARD ZITAMINE` după ce se termină de rulat, așadar se actulizează "la pachet" cu celălalt.
- **Locație**: `Proiecte-Varianta-Finala\DASHBOARD ZITAMINE\`

## 3. Marketing Analytics (`Marketing_Analytics.html`)
- **Surse Date**:
  - **Meta Ads**: Date preluate via API din contul de Ads (prin `fetch_meta.py` -> generează `meta_data.json`).
  - **Google Ads**: Date preluate fie prin Google Ads API fie prin integrare Google Sheets (prin `fetch_google.py` -> generează `google_data.json`).
  - **Klaviyo**: Date de conversii și campanii trimise pe email (prin `fetch_klaviyo.py` -> generează `klaviyo_data.json`).
  - **Google Analytics 4 (GA4)**: Informații de trafic (campanii, canale), profile de vârstă, și surse de achiziție (prin `fetch_ga4.py` și `fetch_ga4_monthly.py` -> generează `ga4_customer_profile.json` și `ga4_monthly_traffic_2026.json`).
- **Script central**: După ce datele brute (fișierele JSON aferente) sunt actualizate independent, scriptul `build_ads_data.py` ia toate fișierele `.json` menționate mai sus și le combină, formatându-le în **`ads_data.js`**.
- **Output vizualizare**: Fișierul HTML încarcă datele din scriptul generat `ads_data.js`.
- **Locație**: `Proiecte-Varianta-Finala\Marketing_Analytics\`
