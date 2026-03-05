$ErrorActionPreference = 'Stop'

Write-Host "Building web app for Capacitor…"
npm run build:cap

Write-Host "Syncing Capacitor platforms…"
npx cap sync

Write-Host "Done. You can open Android Studio with: npx cap open android"
Write-Host "Done. You can open Xcode with: npx cap open ios"

