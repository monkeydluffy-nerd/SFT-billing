// Run this in the browser console (F12) on the SFT Billing app
// This will inspect the localStorage data and identify potential test records

(function() {
  const STORAGE_KEY = 'sft-billing-offline';
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log('No data found in localStorage');
      return;
    }
    
    const store = JSON.parse(raw);
    
    console.log('=== SFT BILLING DATABASE INSPECTION ===');
    console.log('Storage key:', STORAGE_KEY);
    console.log('Data size:', raw.length, 'bytes');
    console.log('');
    
    // Inspect clients
    console.log('--- CLIENTS ---');
    console.log('Total clients:', store.clients?.length || 0);
    if (store.clients) {
      store.clients.forEach((client, idx) => {
        const isTest = client.name.includes('Test') || 
                       client.name.includes('__TEMP') || 
                       client.name.includes('test') ||
                       client.id.includes('temp') ||
                       client.id.includes('test');
        console.log(`  ${idx + 1}. ${client.name} (ID: ${client.id}) ${isTest ? '⚠️ POTENTIAL TEST' : ''}`);
        console.log(`     Email: ${client.email}, Phone: ${client.phone}`);
        console.log(`     GSTIN: ${client.gstin}`);
      });
    }
    
    console.log('');
    
    // Inspect invoices
    console.log('--- INVOICES ---');
    console.log('Total invoices:', store.invoices?.length || 0);
    if (store.invoices) {
      const testInvoiceNumbers = ['038/2026-27', '036/2026-27', '045/2026-27', '046/2026-27'];
      store.invoices.forEach((invoice, idx) => {
        const isTestNum = testInvoiceNumbers.some(t => invoice.number.includes(t));
        const isDraft = invoice.isDraft;
        const isTest = isTestNum || 
                       invoice.number.includes('TEST') || 
                       invoice.number.includes('test') ||
                       invoice.id.includes('temp') ||
                       invoice.id.includes('test') ||
                       (invoice.clientId && (invoice.clientId.includes('temp') || invoice.clientId.includes('test')));
        
        if (isTestNum || isTest) {
          console.log(`  ${idx + 1}. ${invoice.number} (ID: ${invoice.id}) ⚠️ POTENTIAL TEST`);
          console.log(`     Client: ${invoice.clientId}, Issue: ${invoice.issueDate}, Due: ${invoice.dueDate}`);
          console.log(`     Draft: ${isDraft}, PaidAt: ${invoice.paidAt || 'N/A'}`);
          console.log(`     Items: ${invoice.items?.length || 0}`);
        }
      });
      
      // Also show invoices with numbers like 038/2026-27 format
      console.log('\n--- INVOICES WITH 2026-27 FORMAT ---');
      store.invoices.forEach((invoice) => {
        if (invoice.number.includes('2026-27') || invoice.number.includes('2026-27')) {
          console.log(`  ${invoice.number} (ID: ${invoice.id}, Client: ${invoice.clientId})`);
        }
      });
    }
    
    console.log('');
    
    // Inspect payments
    console.log('--- PAYMENTS ---');
    console.log('Total payments:', store.payments?.length || 0);
    if (store.payments) {
      store.payments.forEach((payment, idx) => {
        const isTest = payment.id.includes('test') || 
                       payment.id.includes('temp') ||
                       payment.invoiceId.includes('test') ||
                       payment.invoiceId.includes('temp');
        if (isTest) {
          console.log(`  ${idx + 1}. ${payment.id} (Invoice: ${payment.invoiceId}) ⚠️ POTENTIAL TEST`);
        }
      });
    }
    
    console.log('');
    
    // Inspect activities
    console.log('--- ACTIVITIES ---');
    console.log('Total activities:', store.activities?.length || 0);
    
    console.log('');
    
    // Inspect catalog products
    console.log('--- CATALOG PRODUCTS ---');
    console.log('Total products:', store.catalogProducts?.length || 0);
    
    console.log('');
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log('Total clients:', store.clients?.length || 0);
    console.log('Total invoices:', store.invoices?.length || 0);
    console.log('Total payments:', store.payments?.length || 0);
    console.log('Total activities:', store.activities?.length || 0);
    console.log('Total products:', store.catalogProducts?.length || 0);
    
    // Check for specific test patterns
    console.log('\n=== SPECIFIC TEST PATTERNS ===');
    
    // Check for __temp_flow_check_1__ client
    const tempFlowClient = store.clients?.find(c => c.id.includes('temp_flow') || c.name.includes('__temp_flow'));
    if (tempFlowClient) {
      console.log('⚠️ Found __temp_flow_check_1__ client:', tempFlowClient);
    } else {
      console.log('✓ No __temp_flow_check_1__ client found');
    }
    
    // Check for "Test Client"
    const testClient = store.clients?.find(c => c.name.toLowerCase().includes('test client'));
    if (testClient) {
      console.log('⚠️ Found "Test Client":', testClient);
    } else {
      console.log('✓ No "Test Client" found');
    }
    
    // Check for specific invoice numbers
    const testInvoiceNums = ['038/2026-27', '036/2026-27', '045/2026-27', '046/2026-27'];
    testInvoiceNums.forEach(num => {
      const inv = store.invoices?.find(i => i.number.includes(num));
      if (inv) {
        console.log(`⚠️ Found invoice ${num}:`, inv);
      } else {
        console.log(`✓ No invoice ${num} found`);
      }
    });
    
  } catch (e) {
    console.error('Error inspecting localStorage:', e);
  }
})();