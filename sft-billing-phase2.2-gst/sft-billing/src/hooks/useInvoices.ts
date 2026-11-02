import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useInvoices() {
  const fetcher = useCallback(() => activeDataProvider.getInvoices(), []);
  return useAsyncResource(fetcher);
}
