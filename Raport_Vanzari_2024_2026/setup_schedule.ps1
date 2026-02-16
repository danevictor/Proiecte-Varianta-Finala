# Script for setting up the Monthly Sales Data Refresh Task
$taskName = "ZitamineSalesDashboardUpdate"
$scriptPath = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte Varianta Finala\Raport_Vanzari_2024_2026\process_sales_data.ps1"
$workingDir = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte Varianta Finala\Raport_Vanzari_2024_2026"
$psPath = "powershell.exe"
$args = "-ExecutionPolicy Bypass -File `"$scriptPath`""

# Use schtasks.exe for reliable task creation
# /SC MONTHLY /D 1 /ST 09:00 /F (Force overwrite) /TN TaskName /TR "Command Arguments"
# Note: /TR needs to be quoted carefully if paths have spaces.
# The command is: powershell.exe -ExecutionPolicy Bypass -File "..."
# We wrap the whole TR in quotes, and inner quotes must be escaped consistently.

# Escape quotes for TR. The entire command must be a single string for TR.
# We need: powershell.exe -ExecutionPolicy Bypass -File "C:\Path..."
# For schtasks /TR "CMD", we need backslash-escaped quotes for inner quotes if running from PS Start-Process?
# Actually, simplest is:
$trCommand = "powershell.exe -ExecutionPolicy Bypass -File \`"$scriptPath\`""

Write-Host "Creating Scheduled Task '$taskName'..."
Write-Host "Command: $trCommand"

# Run schtasks
# We use & call operator or Start-Process with ArgumentList array to avoid parsing issues
$params = @("/create", "/tn", "$taskName", "/tr", "$trCommand", "/sc", "monthly", "/d", "1", "/st", "09:00", "/f")
& schtasks.exe $params

Write-Host "Task setup attempt complete. Verify in Task Scheduler."
