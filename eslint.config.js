import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // 'supabase' holds Deno edge functions; the rest are legacy paths removed by cleanup.sh
    ignores: [
      'dist',
      'supabase',
      'backend',
      'scripts',
      'src/pages',
      'src/services',
      'src/store',
      'src/hooks',
      'src/types',
      'src/components/ui',
      'src/components/Header.tsx',
      'src/components/Footer.tsx',
      'src/components/PasswordEntryForm.tsx',
      'src/components/StatusInfo.tsx',
      'vercel-cron-solution.js',
      'vercel-serverless-timer.js'
    ]
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  }
);
