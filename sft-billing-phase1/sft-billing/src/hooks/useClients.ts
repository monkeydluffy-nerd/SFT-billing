import { useAppStore } from "@/stores/appStore";

/** Returns the live clients array from the central app store. Always up-to-date. */
export function useClients() {
  const clients = useAppStore((s) => s.clients);
  return { data: clients, loading: false, error: undefined };
}
