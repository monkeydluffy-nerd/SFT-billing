import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useBusinessProfile() {
  const fetcher = useCallback(() => activeDataProvider.getBusinessProfile(), []);
  return useAsyncResource(fetcher);
}
