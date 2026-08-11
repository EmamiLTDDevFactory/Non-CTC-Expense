/**
 * API Base URL Configuration
 */

const getBaseUrl = (): string => {
  // Environment variable override
  if (
    process.env.EXPO_PUBLIC_API_URL &&
    process.env.EXPO_PUBLIC_API_URL.trim() !== ""
  ) {
    return process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/+$/, "");
  }

  // Web: construct backend URL based on current origin
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // In production or when already running on backend port 3000, use same origin
    if (port === "3000" || process.env.NODE_ENV === "production") {
      return window.location.origin;
    }

    return `${protocol}//${hostname}:3000`;
  }

  // React Native / default fallback
  return "http://172.17.2.21:3000";
};

export const API_BASE_URL = getBaseUrl();


