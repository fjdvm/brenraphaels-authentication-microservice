export type SeedSystem = {
  name: string;
  url: string;
  /** Plain lookup key the UI maps to an icon; not an icon-library component name. */
  iconName: string;
  description: string;
  /** Previous name; an existing System under it is renamed in place, never duplicated. */
  formerName?: string;
  /** Exact callbacks registered for the sign-in handoff; a System with none is untrusted. */
  callbackUrls?: string[];
  modules: string[];
};

// CRMS (CREOMS) is deployed; HRMS/POS/IMS URLs are placeholders pending real deployment.
export const SEED_SYSTEMS: SeedSystem[] = [
  {
    name: "CRMS",
    url: "https://epic-crms.vercel.app",
    callbackUrls: [
      "https://epic-crms.vercel.app/api/portal/callback",
      "http://localhost:3000/api/portal/callback", // ignored in production
    ],
    iconName: "users",
    description: "Customer profiles, marketing, conversations and support tickets.",
    modules: [
      "Dashboard",
      "Customer Profiles",
      "Marketing",
      "Conversations",
      "Tickets",
    ],
  },
  {
    name: "HRMS",
    url: "https://br-hrms.jude-nitram08.workers.dev", // placeholder, pending real deployment
    iconName: "contact",
    description: "Recruitment, employee records, payroll and attendance.",
    modules: [
      "Dashboard",
      "Recruitment and Hiring",
      "Employee Information",
      "Payroll & ESS",
      "Attendance Biometrics",
      "User Management",
    ],
  },
  {
    name: "POS",
    url: "https://br-pos.jude-nitram08.workers.dev", // placeholder, pending real deployment
    iconName: "store",
    description: "Sales, orders, products, branches and stock at the point of sale.",
    modules: [
      "Dashboard",
      "Sales Processing",
      "Order Management",
      "Product Management/Price Configuration",
      "Sales Report Analytics",
      "Location/Branch Management",
      "Stock Management",
    ],
  },
  {
    name: "IMS",
    formerName: "SCMS",
    url: "https://br-ims.jude-nitram08.workers.dev", // placeholder, pending real deployment
    iconName: "package",
    description: "Suppliers, procurement, inventory, production and distribution.",
    modules: [
      "Dashboard",
      "Resources & Suppliers",
      "Orders & Procurement",
      "Inventory Module",
      "Production and Quality",
      "Distribution",
    ],
  },
];

// All 9 Roles. "Super Admin" must stay first: it is the only Role seeded
// with an AccessTemplate, and it is the seeded bootstrap User's Role.
export const SEED_ROLES = [
  "Super Admin",
  "CEO",
  "VP",
  "CRMS Manager",
  "IMS Manager",
  "HRMS Manager",
  "POS Manager",
  "Staff/Employee",
  "Cashier",
] as const;

/** Modules renamed since first seeded: system name -> current name -> former name. Renamed in place. */
export const SEED_MODULE_FORMER_NAMES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  CRMS: { Marketing: "Campaigns" },
};

/** Roles renamed since first seeded: current name -> former name. Renamed in place. */
export const SEED_ROLE_FORMER_NAMES: Readonly<Record<string, string>> = {
  "IMS Manager": "SCMS Manager",
};

export const SUPER_ADMIN_ROLE_NAME = "Super Admin" satisfies (typeof SEED_ROLES)[number];

export const ADMINISTRATOR_ROLE_NAMES: readonly string[] = [SUPER_ADMIN_ROLE_NAME, "CEO"];
