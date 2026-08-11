/**
 * API Base URL Configuration
 */

// Active backend URL fallback for AWS Amplify deployment
const FALLBACK_BACKEND_URL = "https://emami-expense-api.loca.lt";

const getBaseUrl = (): string => {
  // 1. Environment variable override (highest priority)
  if (
    process.env.EXPO_PUBLIC_API_URL &&
    process.env.EXPO_PUBLIC_API_URL.trim() !== ""
  ) {
    return process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/+$/, "");
  }

  // 2. Web browser environment
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // Running locally on port 3000
    if (port === "3000") {
      return window.location.origin;
    }

    // Hosted on AWS Amplify (amplifyapp.com) or production build without env var
    if (hostname.includes("amplifyapp.com") || process.env.NODE_ENV === "production") {
      return FALLBACK_BACKEND_URL;
    }

    return `${protocol}//${hostname}:3000`;
  }

  // 3. React Native / Mobile fallback
  return FALLBACK_BACKEND_URL;
};

export const API_BASE_URL = getBaseUrl();

