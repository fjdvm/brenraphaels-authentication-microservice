export type SeedSystem = {
  name: string;
  url: string;
  /** Plain lookup key the UI maps to an icon; not an icon-library component name. */
  iconName: string;
  description: string;
  modules: string[];
};

// CRMS is deployed; HRMS/POS/SCMS URLs are placeholders pending real deployment.
export const SEED_SYSTEMS: SeedSystem[] = [
  {
    name: "CRMS",
    url: "https://br-crms.jude-nitram08.workers.dev",
    iconName: "users",
    description: "Customer profiles, campaigns, conversations and support tickets.",
    modules: [
      "Dashboard",
      "Customer Profiles",
      "Campaigns",
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
    name: "SCMS",
    url: "https://br-scms.jude-nitram08.workers.dev", // placeholder, pending real deployment
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
  "SCMS Manager",
  "HRMS Manager",
  "POS Manager",
  "Staff/Employee",
  "Cashier",
] as const;

export const SUPER_ADMIN_ROLE_NAME = "Super Admin" satisfies (typeof SEED_ROLES)[number];

export const ADMINISTRATOR_ROLE_NAMES: readonly string[] = [SUPER_ADMIN_ROLE_NAME, "CEO"];
