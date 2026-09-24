import { apiDataProvider } from "./apiDataProvider";
import { mockDataProvider } from "./mockDataProvider";
import type { DataProvider } from "./dataProvider";

/**
 * Production uses FastAPI/openpyxl so invoices, payments, and proof metadata
 * survive reloads and restarts. Vitest uses the isolated in-memory provider
 * for deterministic component fixtures; that branch is test-only and never
 * becomes a browser persistence mechanism.
 */
const provider = import.meta.env.MODE === "test" ? mockDataProvider : apiDataProvider;
export const activeDataProvider: DataProvider = provider;
export type { DataProvider };
