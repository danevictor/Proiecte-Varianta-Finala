import os
import json
import logging
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

# ID-ul fișierului creat de utilizator
SPREADSHEET_ID = '1mRtYP_wMpGuLinc2lNo4mbKONwZWaF_mojkJs9EcB0U'
RANGE_NAME = 'A:B' # Vom citi coloanele A si B (TIMESTAMP si JSON_DATA)

def get_credentials():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return creds

def fetch_google_ads_data():
    logging.info("Trag datele din Google Sheets bridge...")
    creds = get_credentials()
    try:
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID,
                                    range=RANGE_NAME).execute()
        values = result.get('values', [])

        if not values:
            logging.warning('Niciun strat gasit in Sheet. Asigura-te ca ai rulat scriptul in Google Ads!')
            return None

        # Primul rand e header, al doilea ar trebui sa fie json-ul
        if len(values) < 2:
            logging.warning('Tabelul este prea gol (doar header sau nimic).')
            return None
        
        # Extragem ultimul rand din tabel
        last_row = values[-1]
        if len(last_row) < 2:
            logging.warning('Randul este incomplet.')
            return None
            
        json_data_str = last_row[1]
        
        try:
            data = json.loads(json_data_str)
            
            with open('google_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            logging.info("SUCCESS: Datele Google Ads au fost salvate in google_data.json!")
            return data
            
        except json.JSONDecodeError:
            logging.error("Eroare parsare JSON din fisier!")
            return None

    except Exception as err:
        logging.error(f"Eroare API Google Sheets: {err}")

if __name__ == '__main__':
    fetch_google_ads_data()
