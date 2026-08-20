import { NextResponse } from "next/server";

const commerceUrl = (
  process.env.NEXT_PUBLIC_COMMERCE_URL ?? "http://localhost:9000"
).replace(/\/$/, "");
type Context = { params: Promise<{ reference: string }> };

export async function GET(request: Request, context: Context) {
  const reference = (await context.params).reference;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^ACH-\d{4}-\d{6,}$/.test(reference) || token.length < 32)
    return NextResponse.json(
      { message: "Pedido não encontrado" },
      { status: 404 },
    );
  try {
    const response = await fetch(
      `${commerceUrl}/achilles/store/orders/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    return NextResponse.json(await response.json().catch(() => ({})), {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "Pedido temporariamente indisponível" },
      { status: 503 },
    );
  }
}
