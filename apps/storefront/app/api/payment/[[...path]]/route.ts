import { NextResponse } from "next/server";

const commerceUrl = (
  process.env.NEXT_PUBLIC_COMMERCE_URL ?? "http://localhost:9000"
).replace(/\/$/, "");
type Context = { params: Promise<{ path?: string[] }> };
export async function GET(_request: Request, context: Context) {
  return forward("GET", context);
}
export async function POST(request: Request, context: Context) {
  return forward("POST", context, await request.text());
}
async function forward(
  method: string,
  context: Context,
  body?: string,
): Promise<NextResponse> {
  const path = (await context.params).path ?? [];
  if (!path.every((part) => /^[a-zA-Z0-9_-]{1,128}$/.test(part)))
    return NextResponse.json(
      { message: "Rota de pagamento inválida" },
      { status: 400 },
    );
  try {
    const init: RequestInit = {
      method,
      cache: "no-store",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    };
    if (method === "POST") init.body = body || "{}";
    const response = await fetch(
      `${commerceUrl}/achilles/store/payment-intents${path.length ? `/${path.join("/")}` : ""}`,
      init,
    );
    return NextResponse.json(await response.json().catch(() => ({})), {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "Pagamento temporariamente indisponível" },
      { status: 503 },
    );
  }
}
