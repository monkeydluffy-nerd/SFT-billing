import type { BusinessProfile } from "@/types";

/**
 * Placeholder demo data for OUR mock workspace's own business identity —
 * not any real company's information. Editable in Workspace Settings
 * once that lands (Phase 4).
 */
export const mockBusinessProfile: BusinessProfile = {
  name: "SFT Billing Services",
  address: "14 Cathedral Road, Chennai 600086",
  email: "hello@sftbilling.com",
  phone: "+91 44 4567 8900",
  gstin: "33AACFS1234P1Z5",
  pan: "AACFS1234P",
  bank: {
    accountHolder: "SFT Billing Services",
    bankName: "HDFC Bank",
    branch: "Cathedral Road, Chennai",
    accountNumber: "50200012345678",
    ifsc: "HDFC0000123",
  },
  declaration: "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
  authorizedSignatory: "Sabari Krishna",
  defaultGst: { cgstRate: 0.09, sgstRate: 0.09 },
};
