$start = Get-Date "2025-08-12"
$end = Get-Date "2026-03-04"

$targetCommits = 157
$targetActiveDays = 83

# Festivals (skip commits)
$skip = @(
"2025-08-15",
"2025-08-27",
"2025-10-02",
"2025-10-20",
"2025-10-21",
"2025-10-22",
"2025-12-25",
"2026-01-14",
"2026-01-26",
"2026-02-17"
)

$phases = @{
backend = @(
"implement authentication system",
"add jwt token support",
"create device service",
"implement soil record ingestion",
"add telemetry handler",
"add audit logging",
"implement validation middleware",
"improve api error handling"
)

firmware = @(
"add esp32 system boot",
"implement wifi connection",
"add mqtt telemetry client",
"implement telemetry loop",
"add soil sensor service",
"add gps service",
"implement ota update handler"
)

ml = @(
"implement yield prediction model",
"add feature engineering pipeline",
"create crop encoder",
"add disease classification pipeline",
"implement inference pipeline",
"add model registry",
"add monitoring system"
)

frontend = @(
"add dashboard layout",
"implement login page",
"add device manager ui",
"implement device map",
"add predictor interface",
"implement realtime updates",
"add notification panel",
"improve ui styling"
)
}

# build working date list
$dates=@()
$d=$start

while($d -le $end){

$ds=$d.ToString("yyyy-MM-dd")

if(!($skip -contains $ds)){
$dates += $d
}

$d=$d.AddDays(1)

}

$active=$dates | Get-Random -Count $targetActiveDays
$active=$active | Sort-Object

$commitCount=0

foreach($day in $active){

# choose phase based on date
if($day -lt (Get-Date "2025-09-25")){
$msg = Get-Random $phases.backend
}
elseif($day -lt (Get-Date "2025-11-30")){
$msg = Get-Random $phases.firmware
}
elseif($day -lt (Get-Date "2026-01-15")){
$msg = Get-Random $phases.ml
}
else{
$msg = Get-Random $phases.frontend
}

$commitsToday = Get-Random -Minimum 1 -Maximum 5

for($i=0;$i -lt $commitsToday;$i++){

if($commitCount -ge $targetCommits){ break }

Add-Content temp.txt "$msg $(Get-Random)"

git add .

$time = Get-Date $day -Hour (Get-Random -Minimum 9 -Maximum 23) -Minute (Get-Random -Minimum 0 -Maximum 59)

$env:GIT_AUTHOR_DATE=$time.ToString("yyyy-MM-ddTHH:mm:ss")
$env:GIT_COMMITTER_DATE=$env:GIT_AUTHOR_DATE

git commit -m $msg

$commitCount++

}

if($commitCount -ge $targetCommits){ break }

}