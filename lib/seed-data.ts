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

export const SEED_SYSTEMS: SeedSystem[] = [
  {
    name: "CRMS",
    url: "https://epic-crms.vercel.app",
    callbackUrls: [
      "https://epic-crms.vercel.app/api/portal/callback",
      "http://localhost:3000/api/portal/callback", // ignored in production
    ],
    iconName: "users",
    description: "Customer profiles, orders, marketing, conversations, support tickets and feedback.",
    modules: [
      "Dashboard",
      "Customer Profiles",
      "Orders",
      "Payments",
      "Fulfilment",
      "Returns",
      "Tickets",
      "Conversations",
      "Feedback",
      "Marketing",
    ],
  },
  {
    name: "HRMS",
    url: "https://hrms-arae.vercel.app",
    callbackUrls: [
      "https://hrms-arae.vercel.app/api/portal/callback",
      "http://localhost:3001/api/portal/callback", // ignored in production
    ],
    iconName: "contact",
    description: "Recruitment, employee records, payroll and attendance.",
    modules: [
      "Dashboard",
      "Recruitment and Hiring",
      "Employee Information",
      "Payroll & ESS",
      "Attendance",
      "User Management",
    ],
  },
  {
    name: "POS",
    url: "https://web-pos-alpha-vert.vercel.app",
    callbackUrls: [
      "https://web-pos-alpha-vert.vercel.app/api/portal/callback",
      "https://localhost:3002/api/portal/callback",
    ],
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
    url: "https://br-sims.vercel.app",
    callbackUrls: [
      "https://localhost:3003/api/portal/callback",
      "https://br-sims.vercel.app/api/portal/callback",
    ],
    iconName: "package",
    description: "Suppliers, procurement, inventory, production and distribution.",
    modules: [
      "Dashboard",
      "Resources & Suppliers",
      "Orders & Procurement",
      "Goods Receiving",
      "Inventory",
      "Production & Quality",
      "Stock Transfer",
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
  HRMS: { Attendance: "Attendance Biometrics" },
  IMS: {
    Inventory: "Inventory Module",
    "Production & Quality": "Production and Quality",
    "Stock Transfer": "Distribution",
  },
};

/** Roles renamed since first seeded: current name -> former name. Renamed in place. */
export const SEED_ROLE_FORMER_NAMES: Readonly<Record<string, string>> = {
  "IMS Manager": "SCMS Manager",
};

export const SUPER_ADMIN_ROLE_NAME = "Super Admin" satisfies (typeof SEED_ROLES)[number];

export const ADMINISTRATOR_ROLE_NAMES: readonly string[] = [SUPER_ADMIN_ROLE_NAME, "CEO"];
