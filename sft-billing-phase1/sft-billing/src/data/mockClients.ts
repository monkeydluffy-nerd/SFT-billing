import type { Client } from "@/types";
import { isoDateOnly, daysAgo } from "./dateHelpers";

export const mockClients: Client[] = [
  {
    id: "cl_acme",
    name: "Acme Corporation",
    contactName: "Priya Nair",
    email: "billing@acmecorp.com",
    phone: "+91 98450 11234",
    billingAddress: "4th Floor, Prestige Towers, MG Road, Bengaluru 560001",
    clientSince: isoDateOnly(daysAgo(612)),
  },
  {
    id: "cl_nova",
    name: "Nova Systems",
    contactName: "Arvind Menon",
    email: "accounts@novasystems.io",
    phone: "+91 90080 44521",
    billingAddress: "12 Ashok Nagar Industrial Estate, Chennai 600083",
    clientSince: isoDateOnly(daysAgo(401)),
  },
  {
    id: "cl_kestrel",
    name: "Kestrel Retail Pvt. Ltd.",
    contactName: "Rhea D'Souza",
    email: "finance@kestrelretail.in",
    billingAddress: "22B Linking Road, Bandra West, Mumbai 400050",
    clientSince: isoDateOnly(daysAgo(298)),
  },
  {
    id: "cl_orbit",
    name: "Orbit Logistics",
    contactName: "Sanjay Iyer",
    email: "sanjay.iyer@orbitlogistics.com",
    phone: "+91 87654 32109",
    billingAddress: "Plot 9, Sector 18, Gurugram 122015",
    clientSince: isoDateOnly(daysAgo(215)),
  },
  {
    id: "cl_northfield",
    name: "Northfield Consulting",
    contactName: "Meera Krishnan",
    email: "meera@northfieldconsulting.com",
    billingAddress: "88 Residency Road, Bengaluru 560025",
    clientSince: isoDateOnly(daysAgo(174)),
  },
  {
    id: "cl_veyra",
    name: "Veyra Health Diagnostics",
    contactName: "Dr. Anil Bhatt",
    email: "admin@veyrahealth.com",
    phone: "+91 99001 22334",
    billingAddress: "Unit 4, Medipark Complex, Pune 411045",
    clientSince: isoDateOnly(daysAgo(96)),
  },
];
