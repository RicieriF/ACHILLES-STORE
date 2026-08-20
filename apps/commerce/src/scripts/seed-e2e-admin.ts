import type { ExecArgs } from "@medusajs/framework/types";
import { FeatureFlag, Modules } from "@medusajs/framework/utils";

type UserService = {
  listUsers(filters: { email: string }): Promise<Array<{ id: string }>>;
};
type AuthService = {
  register(
    provider: string,
    input: { body: { email: string; password: string } },
  ): Promise<{
    authIdentity?: { id: string };
    error?: Error;
  }>;
  updateAuthIdentities(input: {
    id: string;
    app_metadata: { user_id: string };
  }): Promise<unknown>;
};
type WorkflowEngine = {
  run(
    id: string,
    input: { input: { users: Array<{ email: string; roles?: string[] }> } },
  ): Promise<{ result: Array<{ id: string }> }>;
};

export default async function seedE2eAdmin({ container }: ExecArgs) {
  if (process.env.PAYMENT_TEST_PROVIDER_ENABLED !== "true")
    throw new Error("E2E_ADMIN_REQUIRES_TEST_MODE");
  const email = "e2e-admin@example.invalid";
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password || password.length < 16)
    throw new Error("E2E_ADMIN_PASSWORD_MISSING");
  const userService = container.resolve<UserService>(Modules.USER);
  if ((await userService.listUsers({ email })).length) return;
  const workflow = container.resolve<WorkflowEngine>(Modules.WORKFLOW_ENGINE);
  let roles: string[] = [];
  if (FeatureFlag.isFeatureEnabled("rbac")) {
    const rbac = container.resolve<{
      listRbacRoles(filters: { id: string }): Promise<Array<{ id: string }>>;
    }>(Modules.RBAC);
    roles = (await rbac.listRbacRoles({ id: "role_super_admin" })).map(
      (role) => role.id,
    );
  }
  const { result } = await workflow.run("create-users-workflow", {
    input: { users: [{ email, roles }] },
  });
  const user = result[0];
  if (!user) throw new Error("E2E_ADMIN_USER_CREATE_FAILED");
  const auth = container.resolve<AuthService>(Modules.AUTH);
  const registration = await auth.register("emailpass", {
    body: { email, password },
  });
  if (registration.error || !registration.authIdentity)
    throw registration.error ?? new Error("E2E_ADMIN_AUTH_CREATE_FAILED");
  await auth.updateAuthIdentities({
    id: registration.authIdentity.id,
    app_metadata: { user_id: user.id },
  });
}
