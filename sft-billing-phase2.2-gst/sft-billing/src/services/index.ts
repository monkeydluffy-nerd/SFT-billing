import { apiDataProvider } from "./apiDataProvider";
import { mockDataProvider } from "./mockDataProvider";
import { offlineDataProvider } from "./offlineDataProvider";
import type { DataProvider } from "./dataProvider";

/**
 * Default is the on-PC store. No Supabase and no server is required.
 * Vitest keeps the in-memory provider. Set VITE_USE_API=true only when the
 * local FastAPI workbook backend is running on this computer.
 */
const useLocalApi = import.meta.env.VITE_USE_API === "true";
const provider: DataProvider =
  import.meta.env.MODE === "test"
    ? mockDataProvider
    : useLocalApi
      ? apiDataProvider
      : offlineDataProvider;

export const activeDataProvider: DataProvider = provider;
export type { DataProvider };
