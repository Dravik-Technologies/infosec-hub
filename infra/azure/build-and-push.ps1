param(
  [Parameter(Mandatory = $true)][string]$ResourceGroup,
  [Parameter(Mandatory = $true)][string]$AcrName,
  [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

function Invoke-AcrBuild {
  param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$Dockerfile,
    [string]$Context = "."
  )

  Write-Host "Building ${Repository}:$ImageTag from $Dockerfile"
  az acr build `
    --registry $AcrName `
    --resource-group $ResourceGroup `
    --image "${Repository}:$ImageTag" `
    --file $Dockerfile `
    $Context | Out-Host
}

Invoke-AcrBuild -Repository "hub" -Dockerfile "hub/Dockerfile"
Invoke-AcrBuild -Repository "scorva" -Dockerfile "scorva-v1/Dockerfile"
Invoke-AcrBuild -Repository "lava" -Dockerfile "lava/Dockerfile"
Invoke-AcrBuild -Repository "mash" -Dockerfile "security-dashboard/Dockerfile"
Invoke-AcrBuild -Repository "nexus" -Dockerfile "nexus/Dockerfile"
Invoke-AcrBuild -Repository "data-fabric" -Dockerfile "data-fabric/Dockerfile"
Invoke-AcrBuild -Repository "crater-api" -Dockerfile "emass-app/server/Dockerfile"
Invoke-AcrBuild -Repository "crater-ui" -Dockerfile "emass-app/Dockerfile" -Context "emass-app"
