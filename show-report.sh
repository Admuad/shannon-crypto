#!/bin/bash
# Simple script to display the generated audit report

echo ""
echo "=== Shannon Crypto Audit Report ==="
echo ""

if [ -f "audit-logs/demo-run/report.md" ]; then
    cat audit-logs/demo-run/report.md
else
    echo "Report not found. Running demo first..."
    node demo-simple.cjs
    echo ""
    echo "=== Report Generated ==="
    echo ""
    cat audit-logs/demo-run/report.md
fi

echo ""
echo "=== JSON Output (Structured Data) ==="
echo ""

if [ -f "audit-logs/demo-run/report.json" ]; then
    cat audit-logs/demo-run/report.json | head -50
fi

echo ""
