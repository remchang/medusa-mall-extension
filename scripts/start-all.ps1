# 一键启动脚本（PowerShell / Windows）
#
# 用途：分别开两个窗口启动后端和店面，避免手动切换目录。
# 使用：在仓库根目录执行  ./scripts/start-all.ps1
#
# 注意：本脚本不负责启动 PostgreSQL 与跑迁移/种子，
#       那些是一次性操作，步骤见 README 第 6 节。

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Write-Host "仓库根目录: $root" -ForegroundColor Cyan

# 检查后端 .env 是否存在
$backendEnv = Join-Path $root "apps\backend\.env"
if (-not (Test-Path $backendEnv)) {
    Write-Host "缺少 apps/backend/.env，请先按 README 6.4 节创建。" -ForegroundColor Red
    exit 1
}

# 检查店面 .env.local 是否存在
$storefrontEnv = Join-Path $root "apps\storefront\.env.local"
if (-not (Test-Path $storefrontEnv)) {
    Write-Host "缺少 apps/storefront/.env.local，请先按 README 6.7 节创建。" -ForegroundColor Red
    exit 1
}

Write-Host "启动后端 (端口 9000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\backend'; pnpm run dev"

Write-Host "等待后端就绪..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:9000/health" -UseBasicParsing -TimeoutSec 2
        if ($res.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}

if ($ready) {
    Write-Host "后端已就绪。" -ForegroundColor Green
} else {
    Write-Host "后端 120 秒内未就绪，请检查后端窗口的报错。" -ForegroundColor Yellow
}

Write-Host "启动店面 (端口 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\storefront'; pnpm run dev"

Write-Host ""
Write-Host "完成。访问地址：" -ForegroundColor Cyan
Write-Host "  店面    http://localhost:8000/dk/store"
Write-Host "  管理端  http://localhost:9000/app"
Write-Host "  健康检查 http://localhost:9000/health"
