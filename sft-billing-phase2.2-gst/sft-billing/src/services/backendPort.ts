/**
 * Backend port discovery service for Tauri applications.
 * 
 * The Tauri app starts the backend sidecar on a dynamically allocated port
 * and exposes it via a Tauri command. This module provides a way to discover
 * the backend port at runtime.
 */

let cachedPort: number | null = null;
let portPromise: Promise<number> | null = null;
let initializationError: Error | null = null;
let isInitialized = false;

/**
 * Get the backend port from the Tauri app.
 * Uses Tauri's invoke API to call the `get_backend_port` command.
 * Uses development environment fallbacks only outside production Tauri.
 */
export async function getBackendPort(): Promise<number> {
  if (cachedPort !== null) {
    return cachedPort;
  }

  if (portPromise) {
    return portPromise;
  }

  if (initializationError) {
    throw initializationError;
  }

  portPromise = (async () => {
    try {
      const isProductionBuild = import.meta.env?.PROD === true;

      if (typeof window !== 'undefined') {
        const tauriWindow = window as Window & { __TAURI__?: { invoke: (command: string, args?: unknown) => Promise<unknown> } };
        if (tauriWindow.__TAURI__) {
          const port = await tauriWindow.__TAURI__.invoke('get_backend_port');
          if (typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536) {
            cachedPort = port;
            isInitialized = true;
            return port;
          }
          throw new Error('Tauri returned an invalid backend port.');
        }

        if (isProductionBuild) {
          throw new Error('Tauri backend port command is unavailable in the production app.');
        }

        const metaPort = document.querySelector('meta[name="sft-billing-backend-port"]')?.getAttribute('content');
        if (metaPort) {
          const port = parseInt(metaPort, 10);
          if (!isNaN(port) && port > 0 && port < 65536) {
            cachedPort = port;
            isInitialized = true;
            return port;
          }
        }

        // Check for global variable set by Tauri
        const globalPort = (window as Window & { __SFT_BILLING_BACKEND_PORT__?: number }).__SFT_BILLING_BACKEND_PORT__;
        if (typeof globalPort === 'number' && globalPort > 0 && globalPort < 65536) {
          cachedPort = globalPort;
          isInitialized = true;
          return globalPort;
        }
      }

      if (!isProductionBuild && typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
        const url = new URL(import.meta.env.VITE_API_BASE_URL);
        if (url.port) {
          cachedPort = parseInt(url.port, 10);
          isInitialized = true;
          return cachedPort;
        }
      }

      if (isProductionBuild) {
        throw new Error('Tauri backend port is unavailable in the production app.');
      }

      cachedPort = 8000;
      isInitialized = true;
      return 8000;
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error('Failed to resolve backend port');
      throw initializationError;
    }
  })();

  return portPromise;
}

/**
 * Get the base API URL for the backend.
 * Resolves the port dynamically.
 */
export async function getApiBaseUrl(): Promise<string> {
  const port = await getBackendPort();
  return `http://127.0.0.1:${port}`;
}

/**
 * Initialize the backend port and verify backend readiness.
 * Should be called during app startup before making any API requests.
 * Throws an error if the backend cannot be reached or is not healthy.
 */
export async function initializeBackendConnection(maxRetries = 10, retryDelayMs = 1000): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  const port = await getBackendPort();
  
  // Verify backend health with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          isInitialized = true;
          return baseUrl;
        }
      }
    } catch {
      // Backend not ready yet, wait and retry
    }
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  // If we get here, backend is not ready
  const error = new Error(
    `Backend not ready after ${maxRetries} attempts. ` +
    `Expected backend on port ${port} (${baseUrl}). ` +
    `Please ensure the backend sidecar is running and healthy.`
  );
  initializationError = error;
  throw error;
}

/**
 * Clear the cached port (useful for testing or if backend restarts).
 */
export function clearBackendPortCache(): void {
  cachedPort = null;
  portPromise = null;
  initializationError = null;
  isInitialized = false;
}

/**
 * Check if the backend port has been initialized.
 */
export function isBackendPortInitialized(): boolean {
  return isInitialized && cachedPort !== null && initializationError === null;
}

/**
 * Get the initialization error if any.
 */
export function getBackendInitializationError(): Error | null {
  return initializationError;
}

/**
 * Check if the backend is reachable at the given port.
 */
export async function checkBackendHealth(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Discover the backend port by probing a range of ports.
 * Used as a last resort if the Tauri command fails.
 */
export async function discoverBackendPort(startPort = 8000, endPort = 8010): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    if (await checkBackendHealth(port)) {
      return port;
    }
  }
  throw new Error(`No backend found in port range ${startPort}-${endPort}`);
}