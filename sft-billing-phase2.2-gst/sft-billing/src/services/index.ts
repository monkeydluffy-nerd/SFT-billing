import { apiDataProvider } from "./apiDataProvider";
import { mockDataProvider } from "./mockDataProvider";
import { offlineDataProvider } from "./offlineDataProvider";
import type { DataProvider } from "./dataProvider";

/**
 * Production uses FastAPI/openpyxl so invoices, payments, and proof metadata
 * survive reloads and restarts. Vitest uses the isolated in-memory provider
 * for deterministic component fixtures; that branch is test-only and never
 * becomes a browser persistence mechanism.
 *
 * Production always uses the persistent backend. VITE_USE_API=true can opt
 * development builds into the API provider; other development builds remain
 * offline.
 */
const useApi = import.meta.env.PROD || import.meta.env.VITE_USE_API === "true";
const provider = import.meta.env.MODE === "test" ? mockDataProvider : (useApi ? apiDataProvider : offlineDataProvider);
export const activeDataProvider: DataProvider = provider;
export type { DataProvider };
