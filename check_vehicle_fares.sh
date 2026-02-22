#!/bin/bash

# Diagnostic script to check vehicle/fare config state
# Run: bash check_vehicle_fares.sh

echo "=========================================="
echo "VEHICLE TYPES DIAGNOSTIC CHECK"
echo "=========================================="
echo ""

echo "1. Checking vehicle_specifications table:"
echo "SELECT vehicle_type, display_name, icon_emoji FROM vehicle_specifications ORDER BY display_name;" | sqlite3 database.db 2>/dev/null || echo "   (Supabase database - manual query needed)"

echo ""
echo "2. Checking fare_config table (ALL rows):"
echo "SELECT vehicle_type, base_fare, is_active FROM fare_config ORDER BY vehicle_type;" | sqlite3 database.db 2>/dev/null || echo "   (Supabase database - manual query needed)"

echo ""
echo "3. Checking for vehicles WITHOUT fare configs:"
echo "SELECT vs.vehicle_type, vs.display_name FROM vehicle_specifications vs LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type WHERE fc.id IS NULL;" | sqlite3 database.db 2>/dev/null || echo "   (Supabase database - manual query needed)"

echo ""
echo "4. Checking for fare configs that are NOT active:"
echo "SELECT vehicle_type, is_active, base_fare FROM fare_config WHERE is_active = false;" | sqlite3 database.db 2>/dev/null || echo "   (Supabase database - manual query needed)"

echo ""
echo "To run these queries in Supabase:"
echo "1. Go to Supabase Dashboard > SQL Editor"
echo "2. Run each query above"
echo ""
