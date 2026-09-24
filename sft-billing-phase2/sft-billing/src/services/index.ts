import { mockDataProvider } from "./mockDataProvider";
import type { DataProvider } from "./dataProvider";

/**
 * The entire app imports `activeDataProvider` from here — never
 * `mockDataProvider` directly. When Phase 6 (database/backend
 * integration) arrives, this becomes:
 *
 *   export const activeDataProvider: DataProvider = apiDataProvider;
 *
 * and nothing else in `src/` needs to change.
 */
export const activeDataProvider: DataProvider = mockDataProvider;
export type { DataProvider };
