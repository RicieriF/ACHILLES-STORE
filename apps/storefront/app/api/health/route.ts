export function GET(): Response {
  return Response.json({ service: "storefront", status: "ok" });
}
