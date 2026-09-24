import type { Invoice, InvoiceLineItem } from "@/types";
import { mockClients } from "./mockClients";
import { mockProducts } from "./mockProducts";
import { daysAgo, iso } from "./dateHelpers";
import { createSeededRandom, randomInt, pick } from "./seedRandom";

const rng = createSeededRandom(20260903);

let invoiceCounter = 1000;
function nextInvoiceNumber(): string {
  invoiceCounter += 1;
  return `INV-${invoiceCounter}`;
}

let lineItemCounter = 0;
function makeLineItems(count: number): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const product = pick(rng, mockProducts);
    lineItemCounter += 1;
    items.push({
      id: `li_${lineItemCounter}`,
      productId: product.id,
      description: product.name,
      quantity: randomInt(rng, 1, product.unit === "hour" ? 24 : 3),
      unitPrice: product.defaultUnitPrice,
    });
  }
  return items;
}

const NET_TERMS_DAYS = 15;

/**
 * One historical, already-paid invoice for a given client, issued
 * `monthsAgo` months back. Used to build up twelve months of real paid
 * revenue for the Overview trend chart — every number the chart shows is
 * summed from these records, never a separately hard-coded series.
 */
function historicalPaidInvoice(clientId: string, monthsAgo: number): Invoice {
  const issue = daysAgo(monthsAgo * 30 + randomInt(rng, -4, 4));
  const due = daysAgo(monthsAgo * 30 + randomInt(rng, -4, 4) - NET_TERMS_DAYS);
  const paid = daysAgo(monthsAgo * 30 + randomInt(rng, -4, 4) - NET_TERMS_DAYS + randomInt(rng, 0, 6));
  return {
    id: `iv_${clientId}_h${monthsAgo}`,
    number: nextInvoiceNumber(),
    clientId,
    issueDate: iso(issue),
    dueDate: iso(due),
    items: makeLineItems(randomInt(rng, 1, 4)),
    taxRate: 0.18,
    discount: rng() > 0.85 ? randomInt(rng, 500, 3000) : 0,
    isDraft: false,
    sentAt: iso(issue),
    viewedAt: iso(daysAgo(monthsAgo * 30 - 1)),
    paidAt: iso(paid),
  };
}

const historical: Invoice[] = [];
mockClients.forEach((client, clientIndex) => {
  // Stagger start month per client so not every client bills on the exact
  // same historical cadence.
  for (let monthsAgo = 11; monthsAgo >= 1; monthsAgo -= 1) {
    if ((monthsAgo + clientIndex) % 2 === 0) continue; // realistic gaps, not every client every month
    historical.push(historicalPaidInvoice(client.id, monthsAgo));
  }
});

/**
 * The "current cycle" — the last ~40 days, deliberately covering every
 * status the product needs to demonstrate: paid, pending (not yet due),
 * overdue (both the mild 1–29 day band and the strong 30+ day band), and
 * drafts. Every one of these numbers rolls up into the same Overview
 * totals the rest of the app reads.
 */
const current: Invoice[] = [
  // Paid, recently
  {
    id: "iv_acme_paid1",
    number: nextInvoiceNumber(),
    clientId: "cl_acme",
    issueDate: iso(daysAgo(22)),
    dueDate: iso(daysAgo(7)),
    items: makeLineItems(3),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(22)),
    viewedAt: iso(daysAgo(20)),
    paidAt: iso(daysAgo(4)),
  },
  {
    id: "iv_kestrel_paid1",
    number: nextInvoiceNumber(),
    clientId: "cl_kestrel",
    issueDate: iso(daysAgo(18)),
    dueDate: iso(daysAgo(3)),
    items: makeLineItems(2),
    taxRate: 0.18,
    discount: 1500,
    isDraft: false,
    sentAt: iso(daysAgo(18)),
    viewedAt: iso(daysAgo(17)),
    paidAt: iso(daysAgo(2)),
  },
  // Pending — not yet due
  {
    id: "iv_nova_pending1",
    number: nextInvoiceNumber(),
    clientId: "cl_nova",
    issueDate: iso(daysAgo(6)),
    dueDate: iso(daysAgo(-9)),
    items: makeLineItems(2),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(6)),
    viewedAt: iso(daysAgo(5)),
  },
  {
    id: "iv_orbit_pending1",
    number: nextInvoiceNumber(),
    clientId: "cl_orbit",
    issueDate: iso(daysAgo(3)),
    dueDate: iso(daysAgo(-12)),
    items: makeLineItems(1),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(3)),
  },
  {
    id: "iv_veyra_pending1",
    number: nextInvoiceNumber(),
    clientId: "cl_veyra",
    issueDate: iso(daysAgo(1)),
    dueDate: iso(daysAgo(-14)),
    items: makeLineItems(3),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(1)),
  },
  // Overdue — mild band (1–29 days)
  {
    id: "iv_northfield_overdue_mild1",
    number: nextInvoiceNumber(),
    clientId: "cl_northfield",
    issueDate: iso(daysAgo(28)),
    dueDate: iso(daysAgo(13)),
    items: makeLineItems(2),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(28)),
    viewedAt: iso(daysAgo(26)),
  },
  {
    id: "iv_orbit_overdue_mild2",
    number: nextInvoiceNumber(),
    clientId: "cl_orbit",
    issueDate: iso(daysAgo(21)),
    dueDate: iso(daysAgo(6)),
    items: makeLineItems(1),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(21)),
  },
  {
    id: "iv_kestrel_overdue_mild3",
    number: nextInvoiceNumber(),
    clientId: "cl_kestrel",
    issueDate: iso(daysAgo(19)),
    dueDate: iso(daysAgo(4)),
    items: makeLineItems(2),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(19)),
    viewedAt: iso(daysAgo(18)),
  },
  // Overdue — strong band (30+ days)
  {
    id: "iv_acme_overdue_strong1",
    number: nextInvoiceNumber(),
    clientId: "cl_acme",
    issueDate: iso(daysAgo(49)),
    dueDate: iso(daysAgo(34)),
    items: makeLineItems(4),
    taxRate: 0.18,
    discount: 0,
    isDraft: false,
    sentAt: iso(daysAgo(49)),
    viewedAt: iso(daysAgo(47)),
  },
  {
    id: "iv_nova_overdue_strong2",
    number: nextInvoiceNumber(),
    clientId: "cl_nova",
    issueDate: iso(daysAgo(58)),
    dueDate: iso(daysAgo(43)),
    items: makeLineItems(2),
    taxRate: 0.18,
    discount: 2000,
    isDraft: false,
    sentAt: iso(daysAgo(58)),
  },
  // Drafts — never sent
  {
    id: "iv_veyra_draft1",
    number: nextInvoiceNumber(),
    clientId: "cl_veyra",
    issueDate: iso(daysAgo(0)),
    dueDate: iso(daysAgo(-15)),
    items: makeLineItems(2),
    taxRate: 0.18,
    discount: 0,
    isDraft: true,
  },
  {
    id: "iv_northfield_draft2",
    number: nextInvoiceNumber(),
    clientId: "cl_northfield",
    issueDate: iso(daysAgo(2)),
    dueDate: iso(daysAgo(-13)),
    items: makeLineItems(1),
    taxRate: 0.18,
    discount: 0,
    isDraft: true,
  },
];

export const mockInvoices: Invoice[] = [...historical, ...current];
