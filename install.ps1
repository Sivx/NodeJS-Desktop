$taskService = New-Object -ComObject Schedule.Service
$taskService.Connect()

$rootFolder = $taskService.GetFolder("\")
$taskDefinition = $taskService.NewTask(0)

# Time Trigger - every 5 minutes
$trigger = $taskDefinition.Triggers.Create(1)  # 1 = TimeTrigger
$trigger.StartBoundary = [datetime]::Now.ToString("yyyy-MM-dd'T'HH:mm:ss")
$trigger.Repetition.Interval = "PT5M"
$trigger.Repetition.Duration = "P1D"
$trigger.Enabled = $true

# Action
$batPath = Join-Path (Get-Location) "index2.bat"
$action = $taskDefinition.Actions.Create(0)
$action.Path = "cmd.exe"
$action.Arguments = "/c `"$batPath`""

# Settings
$settings = $taskDefinition.Settings
$settings.Enabled = $true
$settings.Hidden = $true
$settings.StartWhenAvailable = $true
$settings.AllowDemandStart = $true
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false
$settings.MultipleInstances = 0  # Ignore new if already running

# Principal
$taskDefinition.Principal.UserId = "$env:USERNAME"
$taskDefinition.Principal.LogonType = 3
$taskDefinition.Principal.RunLevel = 0

# Register
$rootFolder.RegisterTaskDefinition("RemoteDesktopNode", $taskDefinition, 6, $null, $null, 3, $null)

Write-Output "Task 'RemoteDesktopNode' registered with 5-minute interval."
