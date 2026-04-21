param(
  [Parameter(Mandatory = $true)][string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"

$env:DATABASE_URL = $DatabaseUrl

Push-Location "security-dashboard"
try {
  npm run generate | Out-Host
  npx prisma migrate deploy --schema ..\packages\db\prisma\schema.prisma | Out-Host
}
finally {
  Pop-Location
}
