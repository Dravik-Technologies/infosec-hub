param(
  [Parameter(Mandatory = $true)][string]$ResourceGroup,
  [Parameter(Mandatory = $true)][string]$ContainerAppsEnvironment,
  [Parameter(Mandatory = $true)][string]$AcrName,
  [Parameter(Mandatory = $true)][string]$PostgresServer,
  [Parameter(Mandatory = $true)][string]$PostgresDatabase,
  [Parameter(Mandatory = $true)][string]$PostgresAdminUser,
  [Parameter(Mandatory = $true)][string]$PostgresAdminPassword,
  [Parameter(Mandatory = $true)][string]$HubSessionSecret,
  [Parameter(Mandatory = $true)][string]$ScorvaSessionSecret,
  [Parameter(Mandatory = $true)][string]$ScorvaJwtSecret,
  [Parameter(Mandatory = $true)][string]$CraterJwtSecret,
  [Parameter(Mandatory = $true)][string]$LavaSessionSecret,
  [Parameter(Mandatory = $true)][string]$MashJwtSecret,
  [string]$ImageTag = "latest",
  [string]$AppPrefix = "saf"
)

$ErrorActionPreference = "Stop"

function Get-AppName {
  param([string]$Suffix)
  return "$AppPrefix-$Suffix"
}

function Invoke-AzJson {
  param([string[]]$Arguments)
  return az @Arguments | ConvertFrom-Json
}

function Ensure-ContainerApp {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Image,
    [Parameter(Mandatory = $true)][int]$TargetPort,
    [ValidateSet("external", "internal")][string]$Ingress = "external",
    [hashtable]$Secrets = @{},
    [hashtable]$EnvVars = @{},
    [int]$MinReplicas = 1,
    [int]$MaxReplicas = 1
  )

  $secretArgs = @()
  foreach ($entry in $Secrets.GetEnumerator()) {
    $secretArgs += "$($entry.Key)=$($entry.Value)"
  }

  $envArgs = @()
  foreach ($entry in $EnvVars.GetEnumerator()) {
    $envArgs += "$($entry.Key)=$($entry.Value)"
  }

  $existing = az containerapp show --name $Name --resource-group $ResourceGroup --query name -o tsv 2>$null
  if (-not $existing) {
    $createArgs = @(
      "containerapp", "create",
      "--name", $Name,
      "--resource-group", $ResourceGroup,
      "--environment", $ContainerAppsEnvironment,
      "--image", $Image,
      "--ingress", $Ingress,
      "--target-port", "$TargetPort",
      "--min-replicas", "$MinReplicas",
      "--max-replicas", "$MaxReplicas",
      "--registry-server", $script:AcrLoginServer,
      "--registry-username", $script:AcrUsername,
      "--registry-password", $script:AcrPassword
    )
    if ($secretArgs.Count -gt 0) {
      $createArgs += @("--secrets") + $secretArgs
    }
    if ($envArgs.Count -gt 0) {
      $createArgs += @("--env-vars") + $envArgs
    }
    az @createArgs | Out-Host
  } else {
    if ($secretArgs.Count -gt 0) {
      az containerapp secret set --name $Name --resource-group $ResourceGroup --secrets @secretArgs | Out-Host
    }
    $updateArgs = @(
      "containerapp", "update",
      "--name", $Name,
      "--resource-group", $ResourceGroup,
      "--image", $Image,
      "--min-replicas", "$MinReplicas",
      "--max-replicas", "$MaxReplicas"
    )
    if ($envArgs.Count -gt 0) {
      $updateArgs += @("--set-env-vars") + $envArgs
    }
    az @updateArgs | Out-Host
    az containerapp ingress enable --name $Name --resource-group $ResourceGroup --target-port $TargetPort --type $Ingress | Out-Null
  }

  return az containerapp show --name $Name --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
}

$acr = Invoke-AzJson -Arguments @("acr", "show", "--name", $AcrName, "--resource-group", $ResourceGroup, "-o", "json")
az acr update --name $AcrName --resource-group $ResourceGroup --admin-enabled true | Out-Null
$acrCred = Invoke-AzJson -Arguments @("acr", "credential", "show", "--name", $AcrName, "--resource-group", $ResourceGroup, "-o", "json")

$script:AcrLoginServer = $acr.loginServer
$script:AcrUsername = $acrCred.username
$script:AcrPassword = $acrCred.passwords[0].value

$databaseUrl = "postgresql://${PostgresAdminUser}:${PostgresAdminPassword}@${PostgresServer}.postgres.database.azure.com:5432/${PostgresDatabase}?sslmode=require"

$hubName = Get-AppName "hub"
$scorvaName = Get-AppName "scorva"
$lavaName = Get-AppName "lava"
$mashName = Get-AppName "mash"
$dataFabricName = Get-AppName "data-fabric"
$craterApiName = Get-AppName "crater-api"
$craterUiName = Get-AppName "crater-ui"

$hubFqdn = Ensure-ContainerApp `
  -Name $hubName `
  -Image "$AcrLoginServer/hub:$ImageTag" `
  -TargetPort 3010 `
  -Ingress "external" `
  -Secrets @{ dburl = $databaseUrl; hubsess = $HubSessionSecret } `
  -EnvVars @{
    PORT = "3010"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    SESSION_SECRET = "secretref:hubsess"
    SSO_TOKEN_TTL = "60"
    SCORVA_URL = "http://127.0.0.1:3000"
  }

$hubUrl = "https://$hubFqdn"

$scorvaFqdn = Ensure-ContainerApp `
  -Name $scorvaName `
  -Image "$AcrLoginServer/scorva:$ImageTag" `
  -TargetPort 3000 `
  -Ingress "external" `
  -Secrets @{ dburl = $databaseUrl; scsess = $ScorvaSessionSecret; scjwt = $ScorvaJwtSecret } `
  -EnvVars @{
    PORT = "3000"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    SESSION_SECRET = "secretref:scsess"
    JWT_SECRET = "secretref:scjwt"
    JWT_EXPIRES_IN = "8h"
    HUB_URL = $hubUrl
  }

$scorvaUrl = "https://$scorvaFqdn"

$null = Ensure-ContainerApp `
  -Name $hubName `
  -Image "$AcrLoginServer/hub:$ImageTag" `
  -TargetPort 3010 `
  -Ingress "external" `
  -Secrets @{ dburl = $databaseUrl; hubsess = $HubSessionSecret } `
  -EnvVars @{
    PORT = "3010"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    SESSION_SECRET = "secretref:hubsess"
    SSO_TOKEN_TTL = "60"
    SCORVA_URL = $scorvaUrl
  }

$craterApiFqdn = Ensure-ContainerApp `
  -Name $craterApiName `
  -Image "$AcrLoginServer/crater-api:$ImageTag" `
  -TargetPort 3001 `
  -Ingress "internal" `
  -Secrets @{ dburl = $databaseUrl; crjwt = $CraterJwtSecret } `
  -EnvVars @{
    PORT = "3001"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    JWT_SECRET = "secretref:crjwt"
    JWT_EXPIRES_IN = "7d"
    HUB_URL = $hubUrl
  }

$null = Ensure-ContainerApp `
  -Name $craterUiName `
  -Image "$AcrLoginServer/crater-ui:$ImageTag" `
  -TargetPort 3003 `
  -Ingress "external" `
  -EnvVars @{
    PORT = "3003"
    NODE_ENV = "production"
  }

$null = Ensure-ContainerApp `
  -Name $lavaName `
  -Image "$AcrLoginServer/lava:$ImageTag" `
  -TargetPort 3002 `
  -Ingress "external" `
  -Secrets @{ dburl = $databaseUrl; lvsess = $LavaSessionSecret } `
  -EnvVars @{
    PORT = "3002"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    SESSION_SECRET = "secretref:lvsess"
    HUB_URL = $hubUrl
  }

$null = Ensure-ContainerApp `
  -Name $mashName `
  -Image "$AcrLoginServer/mash:$ImageTag" `
  -TargetPort 8080 `
  -Ingress "external" `
  -Secrets @{ dburl = $databaseUrl; mshjwt = $MashJwtSecret } `
  -EnvVars @{
    PORT = "8080"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    JWT_SECRET = "secretref:mshjwt"
    HUB_URL = $hubUrl
  }

$null = Ensure-ContainerApp `
  -Name $dataFabricName `
  -Image "$AcrLoginServer/data-fabric:$ImageTag" `
  -TargetPort 8081 `
  -Ingress "external" `
  -Secrets @{ dburl = $databaseUrl } `
  -EnvVars @{
    PORT = "8081"
    NODE_ENV = "production"
    DATABASE_URL = "secretref:dburl"
    HUB_URL = $hubUrl
  }

Write-Host ""
Write-Host "Deployment complete."
Write-Host "Hub URL:          $hubUrl"
Write-Host "SCORVA URL:       $scorvaUrl"
Write-Host "Crater API FQDN:  $craterApiFqdn"
Write-Host "Run logs with:    az containerapp logs show -n $hubName -g $ResourceGroup --follow"
