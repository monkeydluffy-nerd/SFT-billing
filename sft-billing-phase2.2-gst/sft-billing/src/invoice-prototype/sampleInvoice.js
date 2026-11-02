import { logoDataUri } from './logoDataUri';

/* Sample payload only — the component reads everything from this shape. */

export const sampleInvoice = {
  seller: {
    name: 'SURFINE',
    nameSuffix: 'TECHNOLOGY',
    legalName: 'SURFINE TECHNOLOGY',
    logo: logoDataUri,
    tagline: 'FORGING A STRONGER TOMORROW',
    address: ['No. 52, 1st Street, Annanagar', 'Tiruvallur - 600072, Tamil Nadu, India'],
    phone: '+91 98765 43210',
    email: 'surfinetechnology@gmail.com',
    website: 'www.surfinetechnology.in',
    gstin: '33ABCDE1234F1Z5',
    pan: 'ABCDE1234F'
  },

  buyer: {
    name: 'M/s Megawin Fabrication Pvt. Ltd.',
    address: ['No. 18, Industrial Estate,', 'Ambattur, Chennai - 600058', 'Tamil Nadu, India'],
    gstin: '33AAACM1234D1Z8',
    state: 'Tamil Nadu (33)'
  },

  meta: [
    { label: 'Invoice No.', value: '038/2026-27' },
    { label: 'Invoice Date', value: '08 Aug 2026' },
    { label: 'Due Date', value: '22 Aug 2026' },
    { label: 'Terms', value: '14 Days' },
    { label: 'PO No.', value: 'PO/4726' },
    { label: 'PO Date', value: '02 Aug 2026' },
    { label: 'Transporter', value: 'VRL Logistics' },
    { label: 'Place of Supply', value: 'Tamil Nadu (33)' }
  ],

  tax: { cgstRate: 9, sgstRate: 9 },

  items: [
    { description: 'Eye Bolt M12', hsn: '7318', qty: 100, unit: 'Nos', rate: 120.0 },
    { description: 'Hex Nut M12', hsn: '7318', qty: 200, unit: 'Nos', rate: 8.5 },
    { description: 'Flat Washer M12', hsn: '7318', qty: 500, unit: 'Nos', rate: 2.0 },
    { description: 'Spring Washer M12', hsn: '7318', qty: 500, unit: 'Nos', rate: 1.5 },
    { description: 'Anchor Bolt M16', hsn: '7318', qty: 50, unit: 'Nos', rate: 250.0 }
  ],

  bank: {
    accountName: 'SURFINE TECHNOLOGY',
    bankName: 'HDFC Bank',
    accountNumber: '5020 0045 6789 12',
    ifsc: 'HDFC0001234',
    branch: 'Ambattur, Chennai'
  },

  declaration:
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',

  footer: {
    left: 'Forging a stronger tomorrow',
    right: 'Thank you for your business'
  }
};
