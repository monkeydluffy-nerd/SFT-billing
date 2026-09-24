import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import type { Payment, PaymentProofUpload, RecordPaymentResult } from "@/types";
import { useAsyncResource } from "./useAsyncResource";

export function usePayments() {
  const fetcher = useCallback(() => activeDataProvider.getPayments(), []);
  const resource = useAsyncResource(fetcher);
  const { reload } = resource;

  const recordPayment = useCallback(
    async (payment: Omit<Payment, "paymentProof">, proof?: PaymentProofUpload): Promise<RecordPaymentResult> => {
      const result = await activeDataProvider.recordPayment(payment, proof);
      // Always reload from the provider after a retained payment result too:
      // proof metadata is persisted state, not transient upload state.
      reload();
      return result;
    },
    [reload],
  );

  return { ...resource, recordPayment };
}
