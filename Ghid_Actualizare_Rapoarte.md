# 📂 Ghid de Actualizare a Rapoartelor și Dashboard-urilor Zitamine

Acest document explică structura celor 3 rapoarte esențiale din ecosistemul Zitamine, focusându-se pe cum sunt automatizate prin API-uri și cum se pot actualiza. 

Toate dashboard-urile front-end (HTML) sunt găzduite live, gratuit și securizat, direct pe **GitHub Pages**.

---

## 1. 📊 Marketing Analytics Dashboard (ROAS & Costuri)
Acest raport consolidează datele de performanță financiară (Spend, Revenue, ROAS, CPA, etc.) din principalele surse de trafic. Evaluează rentabilitatea lunii curente față de cea anterioară.

### Sursa Datelor (Automatizare prin API):
- **Klaviyo API:** Trage date folosind un *Private API Key* prin scriptul `fetch_klaviyo.py`.
- **Meta Ads API:** Folosește un *System User Token* (permanent) generat din Facebook Business Manager, conectat prin `fetch_meta.py`.
- **Google Ads API:** Folosește un "Google Sheets Bridge" extrem de sigur. Google Ads trimite intern, invizibil, rapoarte zilnice într-un tabel, iar scriptul nostru Python (`fetch_google.py`) le ridică prin **OAuth 2.0**.

### Cum se actualizează?
Când se dorește aducerea la zi a numerelor de reclamă, se rulează pipeline-ul din folderul `Marketing_Analytics`:
1. Rulăm descărcarea datelor: `python fetch_klaviyo.py`, `python fetch_meta.py`, `python fetch_google.py`.
2. Asamblăm JS-ul proaspăt: `python build_ads_data.py`.
3. Acest ultim script clădește fisierul `ads_data.js` din care HTML-ul își trage grafica.

---

## 2. 📈 Sales Dashboard (Zitamine_Sales_Dashboard.html)
Un dashboard vizual (gazduit pe `DASHBOARD ZITAMINE`) axat pe volumul brut al comenzilor. Oferă grafice vizuale excelente pentru KPI de tipul: Comenzi noi zilnice, Split pachete A vs B.

### Sursa Datelor (Automatizare prin API):
- Datele fundamentale provin direct din **Shopify API**. Un script se ocupă de descărcarea integrală, la linie, a comenzilor realizate, scutindu-te complet de datoria de a scoate exporturi la mână.
- Funcțiunile locale analizează tiparele de produs/tag-uri și distilează totul într-un fișier central numit `dashboard_data.js`.

### Cum se actualizează?
Actualizarea lui depinde direct de prelevarea noului tabel de comenzi, declanșând din spate precompilarea pentru frontend în `dashboard_data.js`. Prin scrierea codului de push aferent la GitHub se propagă un update masiv instant la adresa URL.

---

## 3. 🔍 Raportul de Vânzări (Cohort Tracking & Dropout / Raport_Vanzari_2024_2026.html)
Aceasta este arhiva de inteligență și retenție (Analytics profund, tip tabel). Analizează *Lifetime Value* și *Retention* pe Cohorte (M1, M2... M24) și clasifică stadiile clienților în funcție de comenzile plasate la fiecare 30 de zile.

### Sursa Datelor (Automatizare prin API):
- **Shopify API direct:** Pipeline-ul principal, controlat nativ de `fetch_shopify_data.py`, se așează pe API-ul de la Shopify și scoate datele masive din spate consolidând fișierul istoric `master_orders.csv`. 
- **Logica Python:** Scriptul mamă scanează fiecare user pe baza email-ului/ID-ului, descoperă prima comandă (momentul ZERO/Cohorta) și calculează activitatea recurentă. Produsul final ce e randat pe web (GitHub Pages) decurge din funcțiile ce populează fișierul `sales_data_2024_2025.js`.
- Notă: În paralel acest sistem poate escupa și vechiul tip de raport tabelar `.xlsx` local, la cerere.

### Cum se actualizează?
Dat fiind faptul că depinde de comenzile lunare de retenție:
1. Ori se rulează pipeline-ul complet de fetch pentru Shopify care actualizează Master-ul și dă trigger rebuild-ului la JavaScript.
2. Ori soliciți AI-ul (comanda `/raport-update`) să inițeze rularea și actualizarea repozitoriului direct către GitHub pentru ca pagina live să afișeze procentele calculate corect.

---

## 💡 Informații Utile de Mentenanță (Valabile pentru Toate Rapoartele)
- Totul din secțiunea *front-end* e găzduit pe `danevictor.github.io`. Acesta funcționează ca un server invizibil, astfel că tot ce commitezi vizual de pe calculator ajunge "live" în câteva secunde.
- Tokenurile expiră extrem de greu, cu excepția Google Ads unde, teoretic, dacă decizi la un moment dat să muți totul pe un alt cont de Cloud/GMail, vei retrage din nou cheia simplă tip OAuth (prin re-rularea `fetch_google.py`).
- Shopify API este cel mai stabil din sistem (Token privat fix) - tot volumul de tracking, cu exactitate de "ce produse și cate comenzi s-au anulat", este susținut de acest canal de descărcare automată.
