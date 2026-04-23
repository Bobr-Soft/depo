/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        pageTitle: 'Depo API – Tesztriport',
        publicPath: 'test-reports',
        filename: 'test-results.html',
        expand: true,
        includeConsoleLog: false,
        darkTheme: false,
      },
    ],
  ],
};
