import { useAppStore } from "@/stores/appStore";

/** Returns the live activity feed from the central app store. Always up-to-date. */
export function useActivity() {
  const activity = useAppStore((s) => s.activity);
  return { data: activity, loading: false, error: undefined };
}
