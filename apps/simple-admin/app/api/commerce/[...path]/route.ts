import { NextRequest, NextResponse } from "next/server";

const backend = process.env.COMMERCE_INTERNAL_URL ?? "http://localhost:9000";
const allowedPrefixes = [
  "auth/user/emailpass",
  "admin/achilles/",
  "admin/customers",
];

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const pathname = path.join("/");
  if (
    !allowedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    )
  ) {
    return NextResponse.json(
      { message: "Operação não permitida." },
      { status: 404 },
    );
  }
  const target = new URL(`/${pathname}`, backend);
  target.search = request.nextUrl.search;
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  const requestInit: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    requestInit.body = await request.text();
  }
  const response = await fetch(target, requestInit);
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
