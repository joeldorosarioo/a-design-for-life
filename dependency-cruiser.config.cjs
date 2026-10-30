module.exports = {
  forbidden: [
    {
      name: 'portfolio-public-entry-only',
      severity: 'error',
      from: { path: '^src/app/\\(portfolio\\)/' },
      to: { path: '^src/features/[^/]+/(?!index\\.ts$|server\\.ts$)' },
    },
    {
      name: 'generic-does-not-reach-features',
      severity: 'error',
      from: { path: '^src/(helpers|components)/' },
      to: { path: '^src/features/', reachable: true },
    },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'feature-public-entry-only',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/[^/]+/(?!index\\.ts$|server\\.ts$)',
        pathNot: '^src/features/$1/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.(?:integration\\.|e2e\\.)?test\\.[cm]?[jt]sx?$' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
