import slop from 'eslint-plugin-slop'

import { defineConfig } from '@moeru/eslint-config'

// Mirrors moeru-ai/airi's eslint.config.ts, with React instead of Vue.
// `moeru-lint` runs oxlint first, then ESLint; the oxlint preset turns off the ESLint
// rules oxlint already covers.

const sourceExtensionImport = [
  'ImportDeclaration[source.value=/^\\.{1,2}\\/.*\\.[cm]?[jt]sx?$/]',
  'ExportNamedDeclaration[source.value=/^\\.{1,2}\\/.*\\.[cm]?[jt]sx?$/]',
  'ExportAllDeclaration[source.value=/^\\.{1,2}\\/.*\\.[cm]?[jt]sx?$/]',
  'ImportExpression[source.value=/^\\.{1,2}\\/.*\\.[cm]?[jt]sx?$/]',
].join(', ')

const errorMessageTernary = {
  message: 'Avoid `error instanceof Error ? error.message : ...`. Use `errorMessageFrom(error)` from \'@moeru/std\', paired with `?? \'fallback\'` when a default is needed.',
  selector: 'ConditionalExpression[test.type=\'BinaryExpression\'][test.operator=\'instanceof\'][test.right.name=\'Error\'][consequent.type=\'MemberExpression\'][consequent.property.name=\'message\']',
}

export default defineConfig({
  masknet: false,
  perfectionist: false,
  preferArrow: false,
  react: true,
  sonarjs: false,
  sortPackageJsonScripts: false,
  typescript: true,
}, {
  ignores: [
    'research/**',
    '**/public/banks/**',
    '**/public/demo/**',
  ],
}, {
  name: 'animalese/slop',
  files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
  plugins: { slop },
  // Full inspection keeps editor and CI results independent of Git history.
  settings: { slop: { inspection: { mode: 'full' } } },
  rules: {
    'slop/max-comment-length': 'error',
    'slop/no-chained-type-assertions': 'error',
    'slop/no-em-dash': 'off',
    'slop/no-jargon': 'error',
    'slop/no-static-only-class': 'error',
    'slop/no-trivial-functions': 'error',
    'slop/no-trivial-type-aliases': 'off',
    'slop/prefer-jsdoc': 'off',
  },
}, {
  rules: {
    'antfu/import-dedupe': 'error',
    'import/order': 'off',
    'markdown/require-alt-text': 'off',
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    'no-restricted-syntax': ['error', errorMessageTernary, 'TSEnumDeclaration[const=true]', 'TSExportAssignment'],
    'pnpm/json-enforce-catalog': 'off',
    'pnpm/json-valid-catalog': 'off',
    'pnpm/yaml-enforce-settings': 'off',
    'style/padding-line-between-statements': 'error',
    'yaml/plain-scalar': 'off',
  },
}, {
  // The app is bundled by Vite, so it follows airi's extensionless imports. The packages
  // keep `.ts` extensions: the bake CLI and scripts run directly under Node's type stripping.
  files: ['apps/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      errorMessageTernary,
      { message: 'Omit TypeScript and JavaScript source extensions from relative imports, dynamic imports, and re-exports.', selector: sourceExtensionImport },
      'TSEnumDeclaration[const=true]',
      'TSExportAssignment',
    ],
  },
}, {
  ignores: [
    '**/*.md',
  ],
  rules: {
    'perfectionist/sort-imports': [
      'error',
      {
        groups: [
          'type-builtin',
          'type-import',
          'type-internal',
          ['type-parent', 'type-sibling', 'type-index'],
          'default-value-builtin',
          'named-value-builtin',
          'value-builtin',
          'default-value-external',
          'named-value-external',
          'value-external',
          'default-value-internal',
          'named-value-internal',
          'value-internal',
          ['default-value-parent', 'default-value-sibling', 'default-value-index'],
          ['named-value-parent', 'named-value-sibling', 'named-value-index'],
          ['wildcard-value-parent', 'wildcard-value-sibling', 'wildcard-value-index'],
          ['value-parent', 'value-sibling', 'value-index'],
          'side-effect',
          'style',
        ],
        newlinesBetween: 1,
      },
    ],
  },
})
