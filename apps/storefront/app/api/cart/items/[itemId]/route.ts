import { NextResponse, type NextRequest } from "next/server";
import { commerceCartRequest } from "../../../../../lib/commerce";
import { bodyObject, cartError, id, quantity } from "../../http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const body = bodyObject(await request.json());
    const cartId = id(body.cartId);
    const itemQuantity = quantity(body.quantity);
    const { itemId } = await params;
    return NextResponse.json({
      cart: await commerceCartRequest(
        `/achilles/store/carts/${cartId}/items/${id(itemId)}`,
        {
          method: "POST",
          body: JSON.stringify({ quantity: itemQuantity }),
        },
      ),
    });
  } catch (error) {
    return cartError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const cartId = id(request.nextUrl.searchParams.get("cartId"));
    const { itemId } = await params;
    return NextResponse.json({
      cart: await commerceCartRequest(
        `/achilles/store/carts/${cartId}/items/${id(itemId)}`,
        { method: "DELETE" },
      ),
    });
  } catch (error) {
    return cartError(error);
  }
}
