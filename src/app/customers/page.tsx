import type { Metadata } from "next";
import { CustomersView } from "@/views/customers";

export const metadata: Metadata = { title: "Customer exposure" };

export default function Page() {
  return <CustomersView />;
}
