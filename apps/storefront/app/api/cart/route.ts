import { NextResponse, type NextRequest } from "next/server";
import { commerceCartRequest } from "../../../lib/commerce";
import { cartError, id } from "./http";

export async function POST() {
  try {
    return NextResponse.json(
      {
        cart: await commerceCartRequest("/achilles/store/carts", {
          method: "POST",
          body: "{}",
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return cartError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const cartId = id(request.nextUrl.searchParams.get("id"));
    return NextResponse.json({
      cart: await commerceCartRequest(`/achilles/store/carts/${cartId}`, {
        method: "GET",
      }),
    });
  } catch (error) {
    return cartError(error);
  }
}
