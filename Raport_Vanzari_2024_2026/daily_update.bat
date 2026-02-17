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
echo ===================================================
echo   UPDATE COMPLETE!
echo   You can now verify the dashboard.
echo ===================================================
pause
