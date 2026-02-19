# build_release.ps1 — Cross-compile release binaries for all platforms.
# Release binaries run in the background (no console window on Windows),
# auto-open the browser, and shut down when the tab is closed.

$ErrorActionPreference = "Stop"
$env:CGO_ENABLED = "0"

$targets = @(
    @{ GOOS="windows"; GOARCH="amd64"; Out="dist/converter-windows-amd64.exe"; Extra="-H windowsgui" },
    @{ GOOS="linux";   GOARCH="amd64"; Out="dist/converter-linux-amd64";       Extra="" },
    @{ GOOS="darwin";  GOARCH="amd64"; Out="dist/converter-macos-amd64";       Extra="" },
    @{ GOOS="darwin";  GOARCH="arm64"; Out="dist/converter-macos-arm64";       Extra="" }
)

New-Item -ItemType Directory -Path dist -Force | Out-Null

foreach ($t in $targets) {
    $env:GOOS   = $t.GOOS
    $env:GOARCH = $t.GOARCH
    $ldflags = "-s -w"
    if ($t.Extra) { $ldflags += " $($t.Extra)" }

    Write-Host "Building $($t.Out) ..." -ForegroundColor Cyan
    go build -tags release -ldflags="$ldflags" -o $t.Out ./cmd/converter
    if ($LASTEXITCODE -ne 0) { throw "Build failed for $($t.Out)" }
}

# Reset to local OS
$env:GOOS   = "windows"
$env:GOARCH = "amd64"

Write-Host "`nAll release binaries:" -ForegroundColor Green
Get-ChildItem dist -File | Format-Table Name, @{N='Size_MB';E={[math]::Round($_.Length/1MB,1)}} -AutoSize
