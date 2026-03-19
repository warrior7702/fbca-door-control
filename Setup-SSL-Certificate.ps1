# Setup-SSL-Certificate.ps1
# Creates and installs self-signed SSL certificate for FBCA Door Control
# Run as Administrator

Write-Host "=== FBCA Door Control SSL Certificate Setup ===" -ForegroundColor Cyan
Write-Host ""

# Create certificate with both IP and localhost
Write-Host "Creating self-signed certificate..." -ForegroundColor Yellow
$cert = New-SelfSignedCertificate `
    -Subject "CN=FBCA Door Control" `
    -DnsName "10.5.5.31", "localhost", "door-control.fbca.local" `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(5) `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1") `
    -FriendlyName "FBCA Door Control SSL"

Write-Host "✓ Certificate created!" -ForegroundColor Green
Write-Host ""

# Export certificate to a file (for browser import if needed)
$certPath = "C:\Users\billy\door-control\fbca-door-control.pfx"
$certPassword = ConvertTo-SecureString -String "FBCADoors2026!" -Force -AsPlainText

Write-Host "Exporting certificate to file..." -ForegroundColor Yellow
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $certPassword | Out-Null
Write-Host "✓ Certificate exported to: $certPath" -ForegroundColor Green
Write-Host "  Password: FBCADoors2026!" -ForegroundColor Yellow
Write-Host ""

# Copy certificate to Trusted Root (so Windows trusts it)
Write-Host "Installing certificate in Trusted Root store..." -ForegroundColor Yellow
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()
Write-Host "✓ Certificate installed in Trusted Root" -ForegroundColor Green
Write-Host ""

# Display certificate details
Write-Host "=== Certificate Details ===" -ForegroundColor Cyan
Write-Host "Subject:    FBCA Door Control" -ForegroundColor White
Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor Yellow
Write-Host "Expires:    $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor White
Write-Host "Store:      LocalMachine\My" -ForegroundColor White
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Update appsettings.json with Kestrel HTTPS configuration" -ForegroundColor White
Write-Host "2. Update Azure AD redirect URIs to include https://10.5.5.31:5003/signin-oidc" -ForegroundColor White
Write-Host "3. Restart the application: dotnet run" -ForegroundColor White
Write-Host "4. Test: https://10.5.5.31:5003" -ForegroundColor White
Write-Host ""
Write-Host "✓ SSL Certificate setup complete!" -ForegroundColor Green
