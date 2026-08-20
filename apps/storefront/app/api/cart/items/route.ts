import { NextResponse, type NextRequest } from "next/server";
import { commerceCartRequest } from "../../../../lib/commerce";
import { bodyObject, cartError, id, quantity } from "../http";

export async function POST(request: NextRequest) {
  try {
    const body = bodyObject(await request.json());
    const cartId = id(body.cartId);
    const variantId = id(body.variantId);
    const itemQuantity = quantity(body.quantity);
    return NextResponse.json({
      cart: await commerceCartRequest(`/achilles/store/carts/${cartId}/items`, {
        method: "POST",
        body: JSON.stringify({ variantId, quantity: itemQuantity }),
      }),
    });
  } catch (error) {
    return cartError(error);
  }
}
