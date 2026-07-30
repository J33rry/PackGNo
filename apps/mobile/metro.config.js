// Metro config tuned for a pnpm monorepo.
// See: https://docs.expo.dev/guides/monorepos/
//
// Only the two monorepo-specific overrides below are set. Symlink support and
// hierarchical lookup are already handled by expo/metro-config's defaults —
// overriding them makes `expo-doctor` fail and can break future SDK upgrades.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/* trigger reloads.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from both the app's and the monorepo root's node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. react-native-appwrite is written against expo-file-system 18.x and calls
//    its legacy API. We pin expo-file-system to the single version Expo SDK 57
//    ships (see the `overrides` block in pnpm-workspace.yaml) so the native
//    build contains only one copy — but in 57.x the legacy functions live at
//    "expo-file-system/legacy" and the root re-exports throw at runtime.
//    Redirect just that package's import; everything else gets the modern API.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'expo-file-system' &&
    context.originModulePath?.includes('react-native-appwrite')
  ) {
    return context.resolveRequest(context, 'expo-file-system/legacy', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
