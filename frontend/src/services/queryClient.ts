import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api";

// 4xx (422 datos inválidos, 413 payload grande) no se arreglan reintentando; solo vale la
// pena reintentar una vez ante una falla de red (status 0) o un 5xx transitorio.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status !== 0 && error.status < 500) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: 500,
    },
  },
});
