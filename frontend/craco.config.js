// craco.config.js
const path = require("path");
require("dotenv").config();

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      return webpackConfig;
    },
  },
};

// Jest (craco test) : même alias "@/" que webpack
webpackConfig.jest = {
  configure: (jestConfig) => {
    jestConfig.moduleNameMapper = {
      ...jestConfig.moduleNameMapper,
      '^@/(.*)$': '<rootDir>/src/$1',
      // Jest 27 ignore le champ "exports" ; le "main" de react-router-dom v7 pointe vers un fichier absent
      '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
      '^react-router/dom$': '<rootDir>/node_modules/react-router/dist/development/dom-export.js',
      '^date-fns/locale$': '<rootDir>/node_modules/date-fns/locale.cjs',
    };
    return jestConfig;
  },
};

module.exports = webpackConfig;
