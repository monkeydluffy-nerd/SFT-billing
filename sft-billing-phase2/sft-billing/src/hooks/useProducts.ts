import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useProducts() {
  const fetcher = useCallback(() => activeDataProvider.getProducts(), []);
  return useAsyncResource(fetcher);
}
