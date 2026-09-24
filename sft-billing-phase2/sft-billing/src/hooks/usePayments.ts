import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function usePayments() {
  const fetcher = useCallback(() => activeDataProvider.getPayments(), []);
  return useAsyncResource(fetcher);
}
