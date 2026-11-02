import type { Client } from "@/types";

export function getClientName(clients: Client[] | undefined, clientId: string): string {
  return clients?.find((c) => c.id === clientId)?.name ?? "Unknown client";
}
