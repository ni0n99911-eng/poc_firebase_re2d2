#!/bin/bash

# Post-build check: verify no uncompiled Svelte 5 runes in production output
# Detects literal $state(, $derived(, $effect( in compiled .js files
# Excludes source maps (.js.map files)

set -e

BUILD_OUTPUT=".svelte-kit/output"
FOUND_ISSUES=0

# Check if build output exists
if [ ! -d "$BUILD_OUTPUT" ]; then
  echo "✓ No build output found at $BUILD_OUTPUT (skipping check)"
  exit 0
fi

# Search for uncompiled runes: patterns that indicate literal source code in compiled output
# Svelte should compile $state(...) to state(...), $derived(...) to derived(...), etc.
# If these patterns appear literally, it's a compilation failure

# Pattern: literal $state( followed by a variable name or number (uncompiled rune syntax)
PATTERNS=(
  '\$state([a-zA-Z0-9_]'   # $state(varName or $state(123
  '\$derived([a-zA-Z0-9_]' # $derived(varName or $derived(123
  '\$effect([a-zA-Z0-9_]'  # $effect(varName or $effect(123
)

for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(find "$BUILD_OUTPUT" -type f -name "*.js" ! -name "*.map" -exec grep -l "$pattern" {} \; 2>/dev/null || true)

  if [ -n "$MATCHES" ]; then
    if [ $FOUND_ISSUES -eq 0 ]; then
      echo "❌ ERROR: Found uncompiled Svelte 5 runes in production build:"
      echo ""
      FOUND_ISSUES=1
    fi

    echo "Pattern: $pattern"
    while IFS= read -r file; do
      # Count occurrences
      COUNT=$(grep -o "$pattern" "$file" 2>/dev/null | wc -l)
      echo "  $file ($COUNT occurrences)"
    done <<< "$MATCHES"
    echo ""
  fi
done

if [ $FOUND_ISSUES -eq 1 ]; then
  echo "This indicates a Svelte compilation failure. Check your rune usage and rebuild."
  exit 1
fi

echo "✓ Build verification passed: no uncompiled runes detected"
exit 0
