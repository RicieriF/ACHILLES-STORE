import { NextResponse } from "next/server";
import { commerceShippingRequest } from "../../../../lib/commerce";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const quote = await commerceShippingRequest(body);
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular a entrega",
      },
      { status: 409 },
    );
  }
}
