import { chromium } from 'playwright';

async function inspectDB() {
  const browser = await chromium.launch({ headless: false });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the app
    await page.goto('http://localhost:1420');
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for data to load
    
    // Check all localStorage keys
    const allKeys = await page.evaluate(() => {
      const keys = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            keys[key] = { type: 'json', size: value.length, preview: JSON.stringify(parsed).slice(0, 1000) };
          } catch {
            keys[key] = { type: 'string', size: value.length, preview: value.slice(0, 500) };
          }
        }
      }
      return keys;
    });
    
    console.log('=== LOCALSTORAGE KEYS ===');
    console.log(JSON.stringify(allKeys, null, 2));
    
    // Also check sessionStorage
    const sessionKeys = await page.evaluate(() => {
      const keys = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            keys[key] = { type: 'json', size: value.length, preview: JSON.stringify(parsed).slice(0, 500) };
          } catch {
            keys[key] = { type: 'string', size: value.length, preview: value.slice(0, 500) };
          }
        }
      }
      return keys;
    });
    
    console.log('=== SESSIONSTORAGE KEYS ===');
    console.log(JSON.stringify(sessionKeys, null, 2));
    
    // Check IndexedDB
    const indexedDBInfo = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const request = indexedDB.databases();
          request.onsuccess = () => {
            resolve(request.result.map(db => ({ name: db.name, version: db.version })));
          };
          request.onerror = () => resolve({ error: request.error });
        } catch (e) {
          resolve({ error: e.message });
        }
      });
    });
    
    console.log('=== INDEXEDDB ===');
    console.log(JSON.stringify(indexedDBInfo, null, 2));
    
    // Now inspect the actual data
    const dataInspection = await page.evaluate(() => {
      // Try different possible storage keys
      const possibleKeys = ['sft-billing-offline', 'sft-billing-offline-v1', 'sft-billing'];
      const results = {};
      
      for (const key of possibleKeys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const store = JSON.parse(raw);
            results[key] = {
              clients: store.clients?.length || 0,
              invoices: store.invoices?.length || 0,
              payments: store.payments?.length || 0,
              activities: store.activities?.length || 0,
              products: store.catalogProducts?.length || 0,
              clientsData: store.clients?.map(c => ({ id: c.id, name: c.name, email: c.email })) || [],
              invoicesData: store.invoices?.map(inv => ({ 
                id: inv.id, 
                number: inv.number, 
                clientId: inv.clientId, 
                issueDate: inv.issueDate, 
                dueDate: inv.dueDate, 
                isDraft: inv.isDraft, 
                paidAt: inv.paidAt 
              })) || [],
              paymentsData: store.payments?.map(p => ({ 
                id: p.id, 
                invoiceId: p.invoiceId, 
                amount: p.amount, 
                receivedAt: p.receivedAt 
              })) || []
            };
          } catch (e) {
            results[key] = { error: e.message };
          }
        }
      }
      return results;
    });
    
    console.log('\n=== DATA INSPECTION ===');
    console.log(JSON.stringify(dataInspection, null, 2));
    
  } catch (err) {
    console.error('Error during inspection:', err.message, err.stack);
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Navigate to the app
    await page.goto('http://localhost:1420');
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for data to load
    
    // Check all localStorage keys
    const allKeys = await page.evaluate(() => {
      const keys = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            keys[key] = { type: 'json', size: value.length, preview: JSON.stringify(parsed).slice(0, 1000) };
          } catch {
            keys[key] = { type: 'string', size: value.length, preview: value.slice(0, 500) };
          }
        }
      }
      return keys;
    });
    
    console.log('=== LOCALSTORAGE KEYS ===');
    console.log(JSON.stringify(allKeys, null, 2));
    
    // Also check sessionStorage
    const sessionKeys = await page.evaluate(() => {
      const keys = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            keys[key] = { type: 'json', size: value.length, preview: JSON.stringify(parsed).slice(0, 500) };
          } catch {
            keys[key] = { type: 'string', size: value.length, preview: value.slice(0, 500) };
          }
        }
      }
      return keys;
    });
    
    console.log('=== SESSIONSTORAGE KEYS ===');
    console.log(JSON.stringify(sessionKeys, null, 2));
    
    // Check IndexedDB
    const indexedDBInfo = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const request = indexedDB.databases();
          request.onsuccess = () => {
            resolve(request.result.map(db => ({ name: db.name, version: db.version })));
          };
          request.onerror = () => resolve({ error: request.error });
        } catch (e) {
          resolve({ error: e.message });
        }
      });
    });
    
    console.log('=== INDEXEDDB ===');
    console.log(JSON.stringify(indexedDBInfo, null, 2));
    
    // Now inspect the actual data
    const dataInspection = await page.evaluate(() => {
      // Try different possible storage keys
      const possibleKeys = ['sft-billing-offline', 'sft-billing-offline-v1', 'sft-billing'];
      const results = {};
      
      for (const key of possibleKeys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const store = JSON.parse(raw);
            results[key] = {
              clients: store.clients?.length || 0,
              invoices: store.invoices?.length || 0,
              payments: store.payments?.length || 0,
              activities: store.activities?.length || 0,
              products: store.catalogProducts?.length || 0,
              clientsData: store.clients?.map(c => ({ id: c.id, name: c.name, email: c.email })) || [],
              invoicesData: store.invoices?.map(inv => ({ 
                id: inv.id, 
                number: inv.number, 
                clientId: inv.clientId, 
                issueDate: inv.issueDate, 
                dueDate: inv.dueDate, 
                isDraft: inv.isDraft, 
                paidAt: inv.paidAt 
              })) || [],
              paymentsData: store.payments?.map(p => ({ 
                id: p.id, 
                invoiceId: p.invoiceId, 
                amount: p.amount, 
                receivedAt: p.receivedAt 
              })) || []
            };
          } catch (e) {
            results[key] = { error: e.message };
          }
        }
      }
      return results;
    });
    
    console.log('\n=== DATA INSPECTION ===');
    console.log(JSON.stringify(dataInspection, null, 2));
    
  } catch (err) {
    console.error('Error during inspection:', err.message, err.stack);
  } finally {
    await browser.close();
  }
})();