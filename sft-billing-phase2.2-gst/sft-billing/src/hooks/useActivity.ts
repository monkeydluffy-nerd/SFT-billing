import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useActivity() {
  const fetcher = useCallback(() => activeDataProvider.getActivity(), []);
  return useAsyncResource(fetcher);
}
