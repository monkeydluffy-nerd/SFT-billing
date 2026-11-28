// Illustrative sample data for the login screen. Never replace with real data: this screen is shown before sign-in.
export const SAMPLE = {
  sales: {
    label: "SALES · THIS MONTH",
    amount: "₹4,82,500",
    delta: "+12.4%",
    bars: [38, 52, 44, 63, 57, 71, 92],
  },
  invoice: {
    number: "001/2026-27",
    status: "Paid",
    client: "Sample Client Pvt Ltd",
    date: "28 Nov 2026",
    item: "Eye bolt MS 25×90 · 500 pcs",
    amount: "₹1,18,000",
    taxLabel: "GST 18%",
    tax: "₹21,240",
    total: "₹1,39,240",
  },
} as const;
