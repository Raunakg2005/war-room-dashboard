import raw from "@/data/shipments.json";
import auditRaw from "@/data/audit.json";

export type Route =
  | "Direct (Pre-Blockade)"
  | "Cape of Good Hope"
  | "Pipeline Bypass"
  | "Held in Gulf"
  | "Overland Truck"
  | "Air Bridge";

export type Product =
  | "Crude Oil"
  | "Refined Petrochemicals"
  | "High-Tech Components"
  | "Pharmaceuticals"
  | "Industrial Machinery"
  | "Consumer Goods";

export interface Shipment {
  id: string;
  date: string;
  route: Route;
  product: Product;
  cargo: string;
  customer: string;
  region: string;
  since: number;
  tons: number;
  value: number;
  rev: number;
  recog: number;
  plan: number;
  actual: number | null;
  delay: number;
  freight: number;
  fuel: number;
  ins: number;
  pen: number;
  cost: number;
  margin: number;
  difot: boolean;
  imputed: boolean;
}

export const SHIPMENTS = raw as Shipment[];
export const AUDIT = auditRaw;

export const ROUTES: Route[] = [
  "Direct (Pre-Blockade)",
  "Cape of Good Hope",
  "Pipeline Bypass",
  "Held in Gulf",
  "Overland Truck",
  "Air Bridge",
];

export const PRODUCTS: Product[] = [
  "Crude Oil",
  "Refined Petrochemicals",
  "High-Tech Components",
  "Pharmaceuticals",
  "Industrial Machinery",
  "Consumer Goods",
];

export const ENERGY: ReadonlySet<Product> = new Set<Product>(["Crude Oil", "Refined Petrochemicals"]);
export const HELD: Route = "Held in Gulf";
export const MERIDIAN = "Meridian Energy Partners";
export const DATA_PULL_DATE = "22 Mar 2026";

export const CUSTOMERS = [...new Set(SHIPMENTS.map((s) => s.customer))].sort();
export const REGIONS = [...new Set(SHIPMENTS.map((s) => s.region))].sort();

export const isEnergy = (s: Shipment) => ENERGY.has(s.product);

export const SHORT_ROUTE: Record<Route, string> = {
  "Direct (Pre-Blockade)": "Direct",
  "Cape of Good Hope": "Cape",
  "Pipeline Bypass": "Pipeline",
  "Held in Gulf": "Held",
  "Overland Truck": "Overland",
  "Air Bridge": "Air",
};
