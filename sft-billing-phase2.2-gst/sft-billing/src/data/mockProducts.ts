import type { Product } from "@/types";

/* Real materials imported from Surfine Technology invoices.
 * These replace the demo service items. Each product carries its
 * description, HSN/SAC code, unit, and rate exactly as it appears
 * on the source invoice. Do not invent prices. */
export const mockProducts: Product[] = [
  /* INV 001/2026-27 — M/S MERCURY FITTINGS (P) LTD */
  {
    id: "pr_pin35",
    code: "PR_PIN35",
    name: "R- PFSS-PIN3.5X1 - F   PIN FORGING",
    defaultUnitPrice: 23,
    unit: "Nos",
    hsnCode: "9989",
  },
  {
    id: "pr_pin40",
    code: "PR_PIN40",
    name: "VAL R-PFSS-PIN4X1 - F   VALVOREM 4.03 PIVOT PIN FORGING",
    defaultUnitPrice: 23,
    unit: "Nos",
    hsnCode: "9989",
  },
  {
    id: "pr_pin45",
    code: "PR_PIN45",
    name: "VAL R-PFSS-PIN41_2X1 - F   VALVOREM 4.53 PIVOT PIN FORGING",
    defaultUnitPrice: 23,
    unit: "Nos",
    hsnCode: "9989",
  },

  /* INV 011/2026-27 — M/S MEGAWIN FABRICATION */
  {
    id: "pr_spring_guide",
    code: "PR_SPRING_GUIDE",
    name: "0802BSGRHDM01 -  SPRING GUIDE ROD MS HEAD  WITHOUT PLATTING",
    defaultUnitPrice: 46,
    unit: "Nos",
    hsnCode: "7318",
  },

  /* INV 015/2026-27 — M/S VIBROMECH ENGINEERS AND SERVICES LTD */
  {
    id: "pr_g445_bolt",
    code: "PR_G445_BOLT",
    name: "VME G445 BOLT  INCLUDING ZINC - WHITE PLATTING",
    defaultUnitPrice: 10,
    unit: "Nos",
    hsnCode: "7318",
  },
  {
    id: "pr_g445_washer",
    code: "PR_G445_WASHER",
    name: "VME G445 WASHER INCLUDING ZINC - WHITE PLATTING",
    defaultUnitPrice: 3.5,
    unit: "Nos",
    hsnCode: "7318",
  },

  /* INV 023/2026-27 — M/S PROTECK METALICS PVT LTD */
  {
    id: "pr_cage_nut",
    code: "PR_CAGE_NUT",
    name: "PART NO - PDM 203100000  -  CAGE NUT TO DRG NO - DTR0000153511  (WITH ZINC PLATTING  - WHITE )",
    defaultUnitPrice: 53,
    unit: "Nos",
    hsnCode: "7318",
  },

  /* INV 029/2026-27 — M/S SRIWIN ELECTRIC */
  {
    id: "pr_trolly_wheel",
    code: "PR_TROLLY_WHEEL",
    name: "TROLLY WHEEL TYPE -1 ( 11 KV) AS PER DRAWING NO -SWEM-BMP-MC-089",
    defaultUnitPrice: 197,
    unit: "Nos",
    hsnCode: "8537",
  },
];