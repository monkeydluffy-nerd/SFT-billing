import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useClients() {
  const fetcher = useCallback(() => activeDataProvider.getClients(), []);
  return useAsyncResource(fetcher);
}
