@echo off
echo ===================================================
echo   ZITAMINE DASHBOARD UPDATE - DAILY ROUTINE
echo ===================================================
echo.
echo 1. Fetching latest data from Shopify (Last 7 Days)...
python "fetch_shopify_data.py" --days 7
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to fetch data. Check your internet connection.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 2. Processing Sales Data...
powershell -ExecutionPolicy Bypass -File "process_sales_data.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to process data.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 3. Updating Marketing Analytics Data...
cd "..\Marketing_Analytics"
python fetch_klaviyo.py
if %ERRORLEVEL% NEQ 0 ( echo [WARNING] Klaviyo fetch had an issue, but continuing... )
python fetch_meta.py
if %ERRORLEVEL% NEQ 0 ( echo [WARNING] Meta fetch had an issue, but continuing... )
python process_google.py
if %ERRORLEVEL% NEQ 0 ( echo [WARNING] Google process had an issue, but continuing... )
python build_ads_data.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Marketing Analytics Data.
    pause
    exit /b %ERRORLEVEL%
)

:: Return to Raport_Vanzari folder
cd "..\Raport_Vanzari_2024_2026"

echo.
echo ===================================================
echo   UPDATE COMPLETE!
echo   You can now verify the dashboard.
echo ===================================================
pause
