import { authenticate, defineMiddlewares } from "@medusajs/framework/http";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/achilles*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
  ],
});
