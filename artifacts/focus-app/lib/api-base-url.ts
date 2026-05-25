/**
 * Resolve the API base URL for the mobile app.
 *
 * Local dev: set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.10:8080)
 * Replit:    EXPO_PUBLIC_DOMAIN is set by the Replit dev script
 */
export function resolveApiBaseUrl(): string | null {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) {
    const host = domain.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return null;
}
