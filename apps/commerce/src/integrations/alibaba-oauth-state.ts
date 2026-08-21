import { randomBytes } from "node:crypto";

const states = new Map<string, number>();
export function issueAlibabaOAuthState(): string {
  const state = randomBytes(24).toString("hex");
  states.set(state, Date.now() + 10 * 60_000);
  return state;
}
export function consumeAlibabaOAuthState(candidate: string): boolean {
  for (const [state, expires] of states) {
    if (expires < Date.now()) states.delete(state);
  }
  const expected = states.get(candidate);
  if (!expected) return false;
  states.delete(candidate);
  return true;
}
