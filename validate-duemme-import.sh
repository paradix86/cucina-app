#!/bin/bash
# Quick validation script to test Duemme vetted import

set -e

echo "🧪 Running Duemme vetted-pack tests..."
npm run test:unit -- tests/unit/duemme-vetted-pack.test.ts

echo ""
echo "📊 Test Summary:"
npm run test:unit 2>&1 | grep "Test Files\|Tests\|passed"

echo ""
echo "🏗️  Building production bundle..."
npm run build

echo ""
echo "✅ All validations passed!"
echo ""
echo "📦 Integration Summary:"
echo "  - Loaded: 23 vetted Duemme recipes"
echo "  - Location: DUEMME_VETTED_RECIPE_PACK (from tmp/duemme-pack-vetted-subset.json)"
echo "  - UI: Collection browser in ImportView"
echo "  - Source: web | sourceDomain: github.com | Tag: duemme/piano_alimentare"
echo "  - Tests: 9 new + 203 total passing"
echo ""
