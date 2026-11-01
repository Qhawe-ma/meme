import { assertSupplyOrFreeze } from "@/server/ledger/invariant";

let started = false;

export function startJobs() {
  if (started) return;
  started = true;
  const timer = setInterval(() => {
    assertSupplyOrFreeze().catch((error) => console.error("[integrity]", error));
  }, 60_000);
  timer.unref?.();
}
