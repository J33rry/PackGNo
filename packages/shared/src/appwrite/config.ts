/**
 * Appwrite connection config, resolved from each app's own environment.
 *
 * The web app reads NEXT_PUBLIC_* vars and the mobile app reads EXPO_PUBLIC_*
 * vars, then both pass the raw values here for validation. Keeping the actual
 * SDK client construction inside each app (not this package) avoids bundling
 * two different Appwrite SDKs (`appwrite` for web, `react-native-appwrite` for
 * Expo) into shared code — this module stays runtime-dependency-free.
 */

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
}

export interface RawAppwriteEnv {
  endpoint?: string | null;
  projectId?: string | null;
  databaseId?: string | null;
}

/**
 * Validate raw env values into a fully-populated {@link AppwriteConfig}.
 * Throws a descriptive error naming every missing field so misconfiguration
 * surfaces immediately at startup rather than as an opaque network failure.
 */
export function resolveAppwriteConfig(raw: RawAppwriteEnv): AppwriteConfig {
  const missing: string[] = [];
  if (!raw.endpoint) missing.push('endpoint (APPWRITE_ENDPOINT)');
  if (!raw.projectId) missing.push('projectId (APPWRITE_PROJECT_ID)');
  if (!raw.databaseId) missing.push('databaseId (APPWRITE_DATABASE_ID)');

  if (missing.length > 0) {
    throw new Error(
      `[appwrite] Missing required configuration: ${missing.join(', ')}. ` +
        'Copy the .env example file for your app and fill in your Appwrite Cloud values.',
    );
  }

  return {
    endpoint: raw.endpoint!,
    projectId: raw.projectId!,
    databaseId: raw.databaseId!,
  };
}
