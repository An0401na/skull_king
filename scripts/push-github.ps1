# GitHub에 올린 뒤 Render Blueprint로 배포합니다.
# 사용법: .\scripts\push-github.ps1 -Username "당신의깃허브아이디"

param(
  [Parameter(Mandatory = $true)]
  [string]$Username,
  [string]$RepoName = "skull_king"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path .git)) { git init; git branch -M main }

$remote = "https://github.com/$Username/$RepoName.git"
$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
  git remote set-url origin $remote
} else {
  git remote add origin $remote
}

Write-Host ""
Write-Host "=== 1단계: 브라우저에서 저장소 만들기 ===" -ForegroundColor Cyan
Write-Host "  https://github.com/new?name=$RepoName"
Write-Host "  - Public 선택"
Write-Host "  - README 추가 하지 않기 (빈 저장소)"
Write-Host ""
Write-Host "=== 2단계: push ===" -ForegroundColor Cyan
Write-Host "  git push -u origin main"
Write-Host ""
Write-Host "=== 3단계: Render ===" -ForegroundColor Cyan
Write-Host "  https://dashboard.render.com/select-repo?type=blueprint"
Write-Host "  저장소 선택 -> Apply -> 배포 URL 복사"
Write-Host ""

$push = Read-Host "저장소를 만들었으면 Enter (push 실행), 취소는 n"
if ($push -ne "n") {
  git add -A
  git diff --cached --quiet 2>$null
  if ($LASTEXITCODE -ne 0) { git commit -m "Update Skull King" }
  git push -u origin main
  Write-Host "Push 완료. Render Blueprint에서 저장소를 연결하세요." -ForegroundColor Green
}
