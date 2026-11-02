# Universal Installer & Linker for Z-Brain Plugin (Antigravity & ZCode)
[CmdletBinding()]
param(
    [switch]$Uninstall
)

$repoRoot = $PSScriptRoot
$pluginSrc = Join-Path $repoRoot "plugins\z-brain"

$targets = @(
    (Join-Path $env:USERPROFILE ".gemini\config\plugins\z-brain"),
    (Join-Path $env:USERPROFILE ".zcode\plugins\z-brain")
)

if ($Uninstall) {
    foreach ($target in $targets) {
        if (Test-Path $target) {
            Write-Host "Removing link: $target" -ForegroundColor Yellow
            $item = Get-Item $target -Force
            if ($item.Attributes -match "ReparsePoint") {
                [System.IO.Directory]::Delete($target)
            } else {
                Remove-Item -Path $target -Recurse -Force
            }
        }
    }
    Write-Host "Z-Brain unlinked successfully." -ForegroundColor Green
    exit 0
}

Write-Host "Linking Z-Brain from $pluginSrc..." -ForegroundColor Cyan

foreach ($target in $targets) {
    $parent = Split-Path $target -Parent
    if (!(Test-Path $parent)) {
        New-Item -Path $parent -ItemType Directory -Force | Out-Null
    }

    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.Attributes -match "ReparsePoint") {
            $currentTarget = (Get-Item $target).Target
            if ($currentTarget -eq $pluginSrc) {
                Write-Host "Junction already points to $pluginSrc at $target" -ForegroundColor Gray
                continue
            } else {
                Write-Host "Re-pointing junction from $currentTarget to $pluginSrc..." -ForegroundColor Yellow
                [System.IO.Directory]::Delete($target)
            }
        } else {
            Write-Host "Replacing existing directory with junction at $target..." -ForegroundColor Yellow
            Remove-Item -Path $target -Recurse -Force
        }
    }

    try {
        New-Item -ItemType Junction -Path $target -Target $pluginSrc -Force | Out-Null
        Write-Host "  -> Created Junction: $target -> $pluginSrc" -ForegroundColor Green
    } catch {
        Write-Host "  -> Junction creation failed, falling back to copy: $_" -ForegroundColor Yellow
        Copy-Item -Path $pluginSrc -Destination $target -Recurse -Force
    }
}

Write-Host "`nZ-Brain plugin linked successfully!" -ForegroundColor Green
Write-Host "Verify MCP tools with: /z-brain status or reload Antigravity." -ForegroundColor White
