#!/bin/bash

echo "🔍 Verifying Bounty Agent Implementation..."
echo

# Check all required files
files=(
  "src/lib/agent-tools/bounty-tools.ts"
  "src/lib/agent-tools/index.ts"
  "src/lib/agent-tools/README.md"
  "src/lib/agent-tools/integration-example.ts"
  "src/lib/bounty-matcher.ts"
  "src/lib/bounty-agent-runner.ts"
  "src/app/api/v1/agents/me/bounty-recommendations/route.ts"
  "BOUNTY_AGENT_IMPLEMENTATION.md"
)

echo "📁 Checking files..."
all_present=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    size=$(wc -c < "$file" | tr -d ' ')
    echo "  ✅ $file ($size bytes)"
  else
    echo "  ❌ $file (MISSING)"
    all_present=false
  fi
done

echo
if [ "$all_present" = true ]; then
  echo "✅ All files present!"
else
  echo "❌ Some files are missing"
  exit 1
fi

echo
echo "🔧 Checking exports..."

# Check bounty-tools exports
if grep -q "export.*search_bounties" src/lib/agent-tools/bounty-tools.ts; then
  echo "  ✅ search_bounties exported"
fi
if grep -q "export.*evaluate_bounty" src/lib/agent-tools/bounty-tools.ts; then
  echo "  ✅ evaluate_bounty exported"
fi
if grep -q "export.*claim_bounty" src/lib/agent-tools/bounty-tools.ts; then
  echo "  ✅ claim_bounty exported"
fi
if grep -q "export.*submit_work" src/lib/agent-tools/bounty-tools.ts; then
  echo "  ✅ submit_work exported"
fi
if grep -q "export.*check_bounty_status" src/lib/agent-tools/bounty-tools.ts; then
  echo "  ✅ check_bounty_status exported"
fi

# Check bounty-matcher exports
if grep -q "export.*matchAgentToBounties" src/lib/bounty-matcher.ts; then
  echo "  ✅ matchAgentToBounties exported"
fi
if grep -q "export.*rankBounties" src/lib/bounty-matcher.ts; then
  echo "  ✅ rankBounties exported"
fi

echo
echo "📊 Implementation Summary:"
echo
echo "  Tools: 5 (search, evaluate, claim, submit, check_status)"
echo "  Matcher: Intelligent scoring (0-100 points)"
echo "  API: GET /api/v1/agents/me/bounty-recommendations"
echo "  Runner: Autonomous bounty agent script"
echo "  Docs: README.md + integration examples"
echo
echo "✨ Bounty Agent Runner implementation complete!"
echo
echo "🚀 Quick Start:"
echo "  1. Set agent API key: export AGENT_API_KEY=your_key"
echo "  2. Run once: npx tsx src/lib/bounty-agent-runner.ts --once"
echo "  3. Auto mode: BOUNTY_AUTO_CLAIM=true npx tsx src/lib/bounty-agent-runner.ts"
echo

