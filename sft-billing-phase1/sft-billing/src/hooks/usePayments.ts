import { useAppStore } from "@/stores/appStore";

/** Returns the live payments array from the central app store. Always up-to-date. */
export function usePayments() {
  const payments = useAppStore((s) => s.payments);
  return { data: payments, loading: false, error: undefined };
}
