import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useCatalogProducts() {
  const fetcher = useCallback(() => activeDataProvider.getCatalogProducts(), []);
  return useAsyncResource(fetcher);
}
