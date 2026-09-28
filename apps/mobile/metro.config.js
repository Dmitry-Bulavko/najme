const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm hoists workspace packages into the monorepo root's node_modules and keeps each package's
// direct dependencies in a nested `.pnpm` store, so Metro needs to watch the whole workspace and
// resolve node_modules from both the app and the root (see docs/specs/15-mobile-scaffold.md).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// `@najme/*` packages ship dual ESM/CJS builds; disable the package exports field resolution quirk
// that otherwise makes Metro prefer a `browser` condition unavailable for these Node-agnostic
// packages, and keep symlink resolution enabled for pnpm's linked workspace packages.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
