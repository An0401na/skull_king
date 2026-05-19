# PC에서 서버 실행 (같은 Wi-Fi / localhost)
Set-Location $PSScriptRoot\..
if (-not (Test-Path node_modules)) { npm install }
Write-Host "http://localhost:3000" -ForegroundColor Green
npm start
