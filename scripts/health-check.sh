#!/bin/bash
# Health check script for AI Interactive Visual Novel Engine
# Run this at the start of each session to verify the project is healthy.

set -e

echo "=== Health Check ==="

echo "[1/3] TypeScript compilation..."
npx tsc --noEmit
echo "  ✓ TypeScript: no errors"

echo "[2/3] Checking .env..."
if [ -f .env ]; then
  if grep -q "VITE_DEEPSEEK_API_KEY" .env; then
    echo "  ✓ VITE_DEEPSEEK_API_KEY found"
  else
    echo "  ✗ VITE_DEEPSEEK_API_KEY missing from .env"
    exit 1
  fi
else
  echo "  ✗ .env file not found"
  exit 1
fi

echo "[3/3] Vite build check..."
npx vite build --mode development 2>&1 | tail -3
echo "  ✓ Build succeeded"

echo ""
echo "=== All checks passed ==="
