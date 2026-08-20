# DMgp - Démarrage rapide
Write-Host "🚀 Démarrage DMgp..." -ForegroundColor Cyan

# Backend
Write-Host "`n📦 Installation backend..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
npm install

Write-Host "`n📦 Installation frontend..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm install

Write-Host "`n✅ Installation terminée !" -ForegroundColor Green
if (-not (Test-Path "$PSScriptRootackend\.env")) {
  Write-Host "`n⚠️  backend\.env manquant : copiez backend\.env.example et renseignez-le." -ForegroundColor Red
}
Write-Host ""
Write-Host "Pour démarrer :" -ForegroundColor White
Write-Host "  Backend  → cd backend && npm run dev   (port 3001)" -ForegroundColor Cyan
Write-Host "  Frontend → cd frontend && npm run dev  (port 5173)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Puis ouvrir : http://localhost:5173" -ForegroundColor Green
Write-Host "Admin     : voir ADMIN_EMAIL / ADMIN_PASSWORD dans backend\.env" -ForegroundColor Yellow

Set-Location $PSScriptRoot
