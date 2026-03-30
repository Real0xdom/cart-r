param(
  [Parameter(Mandatory = $true)]
  [string]$BookingId
)

Write-Host "Open Supabase SQL editor and run:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. C:\cart-r-main\supabase\debug_booking_refund_trace.sql" -ForegroundColor Yellow
Write-Host "   Replace the placeholder UUID with: $BookingId"
Write-Host ""
Write-Host "2. If the booking is expired and still pending, run:" -ForegroundColor Yellow
Write-Host "   C:\cart-r-main\supabase\debug_expire_booking_search.sql"
Write-Host "   Replace both placeholder UUIDs with booking/customer ids."
Write-Host ""
Write-Host "3. To find more stuck cases, run:" -ForegroundColor Yellow
Write-Host "   C:\cart-r-main\supabase\debug_expired_escrow_scan.sql"
