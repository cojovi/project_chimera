#!/usr/bin/env bash
# One-shot cleanup: removes all legacy files from the pre-rebuild Project Chimera.
# Run once from the repo root:  bash cleanup.sh
set -uo pipefail
cd "$(dirname "$0")"

echo ">> Removing legacy frontend..."
rm -rf src/pages src/services src/store src/hooks src/types src/components/ui
rm -f src/components/Header.tsx src/components/Footer.tsx \
      src/components/PasswordEntryForm.tsx src/components/StatusInfo.tsx

echo ">> Removing legacy backend + scripts..."
rm -rf backend scripts
rm -f vercel-cron-solution.js vercel-serverless-timer.js

echo ">> Removing stale Supabase artifacts (keeping v1 migration + new functions)..."
rm -rf supabase/functions/send-email-on-trigger supabase/functions/process-storage-files \
       supabase/functions/process-scheduled-tasks supabase/functions/validate-password
rm -f supabase/migrations/20250501231155_snowy_valley.sql \
      supabase/migrations/20250501232826_amber_manor.sql \
      supabase/migrations/20250502175434_long_pebble.sql \
      supabase/migrations/20250502204926_broad_cave.sql

echo ">> Removing stale docs, test files, duplicate git dir..."
rm -f CHANGES.md VERCEL-DEPLOYMENT.md SETUP.md test-email.txt test-file.txt \
      test-payload.txt text-prompt.txt .mount-test .DS_Store
rm -rf ".git 2" .bolt

echo ">> Widening tsconfig include back to all of src/..."
cat > tsconfig.app.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
EOF

echo ">> Refreshing node_modules..."
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund

echo ">> Verifying build..."
npm run build && echo ">> CLEANUP COMPLETE — all green." || echo ">> BUILD FAILED — check output above."

echo ">> You can delete this script when done: rm cleanup.sh"
