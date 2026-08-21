export type RuntimeProviderHealth = {
  connected: boolean;
  checkedAt: string;
  health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED";
  capabilities: Record<string, boolean>;
  errorCode: string | null;
  testMode: boolean;
};

const states = new Map<string, RuntimeProviderHealth>();

export const setRuntimeProviderHealth = (
  provider: "CJ" | "ALIBABA",
  health: RuntimeProviderHealth,
): void => {
  states.set(provider, health);
};

export const getRuntimeProviderHealth = (
  provider: "CJ" | "ALIBABA",
): RuntimeProviderHealth | undefined => states.get(provider);

export const clearRuntimeProviderHealth = (): void => {
  states.clear();
};
