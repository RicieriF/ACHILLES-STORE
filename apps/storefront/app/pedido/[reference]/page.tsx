import type { Metadata } from "next";
import { OrderClient } from "./order-client";

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reference } = await params;
  const { token = "" } = await searchParams;
  return <OrderClient reference={reference} token={token} />;
}
