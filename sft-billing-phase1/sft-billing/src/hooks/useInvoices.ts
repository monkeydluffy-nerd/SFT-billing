import { useAppStore } from "@/stores/appStore";

/** Returns the live invoices array from the central app store. Always up-to-date. */
export function useInvoices() {
  const invoices = useAppStore((s) => s.invoices);
  return { data: invoices, loading: false, error: undefined };
}
