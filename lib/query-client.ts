import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

function extractDomain(): string | null {
  try {
    const linkingUrl = Linking.createURL("/");
    if (linkingUrl) {
      const cleaned = linkingUrl
        .replace("exp://", "https://")
        .replace("exps://", "https://");
      const parsed = new URL(cleaned);
      if (parsed.hostname && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        return parsed.hostname;
      }
    }
  } catch {}

  try {
    const m2 = (Constants as any)?.manifest2;
    const hostUri =
      m2?.extra?.expoGo?.debuggerHost ||
      m2?.extra?.expoClient?.hostUri;
    if (hostUri) {
      const h = hostUri.split(":")[0];
      if (h && h !== "localhost" && h !== "127.0.0.1") {
        return h;
      }
    }
  } catch {}

  try {
    const m = (Constants as any)?.manifest;
    const hostUri = m?.debuggerHost || m?.hostUri;
    if (hostUri) {
      const h = hostUri.split(":")[0];
      if (h && h !== "localhost" && h !== "127.0.0.1") {
        return h;
      }
    }
  } catch {}

  try {
    const expUrl = (Constants as any)?.experienceUrl;
    if (expUrl) {
      const cleaned = expUrl.replace("exp://", "https://").replace("exps://", "https://");
      const parsed = new URL(cleaned);
      if (parsed.hostname && parsed.hostname !== "localhost") {
        return parsed.hostname;
      }
    }
  } catch {}

  return null;
}

export function getApiUrl(): string {
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;

  if (envDomain) {
    const hostname = envDomain.replace(/:\d+$/, "");
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
      const origin = window.location.origin;
      if (origin.includes("replit.dev") || origin.includes("replit.app")) {
        return `https://${envDomain}/`;
      }
    }
    return `https://${hostname}/`;
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    return window.location.origin + "/";
  }

  const domain = extractDomain();
  if (domain) {
    return `https://${domain}/`;
  }

  return "https://reliableturftools.replit.app/";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url.toString(), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
