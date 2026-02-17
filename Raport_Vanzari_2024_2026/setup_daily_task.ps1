$taskName = "ZitamineDailyReportUpdate"
$actionPath = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026\daily_update.bat"
$workingDir = "c:\Users\Zitamine\zitamine\Drive - NEW\Antigravity\Proiecte-Varianta-Finala\Raport_Vanzari_2024_2026"

# Create Action
$action = New-ScheduledTaskAction -Execute $actionPath -WorkingDirectory $workingDir

# Create Trigger (Daily at 9:00 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At 9:00AM

# Create Settings (Allow start if on battery, wake to run, etc.)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun

# Register Task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Updates Zitamine Sales Report Daily at 9 AM" -Force

Write-Host "Scheduled Task '$taskName' created successfully. Runs daily at 9:00 AM."
