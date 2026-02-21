# Teste de Compiladores Node.js
# Executar: powershell -ExecutionPolicy Bypass -File test-compilers.ps1

$ErrorActionPreference = "Continue"
$projectDir = "C:\Users\darci\desenvolvimento\insta_scrap"
$outDir = "$projectDir\test-compilers"
$srcEntry = "$projectDir\dist\index.js"

Write-Host "=== Teste de Compiladores Node.js ===" -ForegroundColor Cyan

# Limpar diretório de teste
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

# Compilar TypeScript primeiro
Write-Host "`n[1/5] Compilando TypeScript..." -ForegroundColor Yellow
Set-Location $projectDir
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: Build falhou" -ForegroundColor Red; exit 1 }

# Lista de compiladores para testar
$compilers = @(
    @{
        Name = "yao-pkg"
        Command = "npx @yao-pkg/pkg dist/index.js --targets node20-win-x64 --public --options node -o test-compilers/insta-yao-pkg.exe"
    },
    @{
        Name = "yao-pkg-node22"
        Command = "npx @yao-pkg/pkg dist/index.js --targets node22-win-x64 --public --options node -o test-compilers/insta-yao-pkg-node22.exe"
    },
    @{
        Name = "fossilize-sea"
        Command = "npx fossilize dist/index.js --out-dir test-compilers --output-name insta-fossilize.exe --no-bundle"
    }
)

# Compilar com cada compilador
foreach ($comp in $compilers) {
    Write-Host "`n[COMPILANDO] $($comp.Name)..." -ForegroundColor Cyan
    
    # Limpar saída anterior do compilador específico
    Get-ChildItem $outDir -Filter "insta-$($comp.Name)*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    
    # Executar comando
    Set-Location $projectDir
    Invoke-Expression $comp.Command 2>&1 | Out-Null
    
    # Renomear resultado se necessário (fossilize naming diferente)
    $fossilizeFile = "$outDir\insta-fossilize.exe-win-x64.exe"
    if ($comp.Name -eq "fossilize-sea" -and (Test-Path $fossilizeFile)) {
        Move-Item $fossilizeFile "$outDir\insta-fossilize.exe" -Force
    }
    
    # Verificar resultado
    $exePattern = "insta-$($comp.Name)*.exe"
    $exe = Get-ChildItem $outDir -Filter $exePattern -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($exe) {
        Write-Host "  SUCESSO: $($exe.Name) ($([math]::Round($exe.Length/1MB, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  FALHA: Nenhum executável gerado" -ForegroundColor Red
    }
}

# Listar resultados
Write-Host "`n=== RESULTADOS ===" -ForegroundColor Cyan
Get-ChildItem $outDir -Filter "*.exe" | ForEach-Object {
    Write-Host "$($_.Name) - $([math]::Round($_.Length/1MB, 2)) MB"
}

Write-Host "`nPara testar manualmente, execute:" -ForegroundColor Yellow
Write-Host "  .\test-compilers\insta-<nome>.exe"
Write-Host "`nPressione ENTER para sair..."
Read-Host
