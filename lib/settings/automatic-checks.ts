/** The Automatic checks CREOMS serves and saves (CREOMS `features/settings/automatic-checks.ts`): a switch per flag-only rule and its numbers. */
type Switch = { enabled: boolean };

export interface AutomaticChecks {
  paymentProof: Record<"reference" | "amount" | "date" | "recipient", Switch>;
  cod: {
    firstOrder: Switch;
    firstOrderOverAmount: Switch & { amountInCentavos: number };
    earlierRefusal: Switch;
    earlierFailedDelivery: Switch;
  };
  returns: { frequentReturns: Switch & { count: number; days: number }; reusedPhoto: Switch };
  dashboard: {
    unverifiedPayments: Switch & { count: number; waitHours: number };
    returnSpike: Switch & { count: number; days: number };
    unresolvedFailedDeliveries: Switch & { count: number };
  };
}

/** A whole number from 1 to `max`, or null. */
export function toWhole(text: string, max: number): number | null {
  if (!/^\d{1,10}$/.test(text.trim())) return null;
  const n = Number(text);
  return n >= 1 && n <= max ? n : null;
}

/** Whole pesos (no centavos) to centavos, or null. A first-order amount may be 0. */
export function pesosToCentavos(text: string): number | null {
  if (!/^\d{1,12}$/.test(text.trim())) return null;
  return Number(text) * 100;
}

export const centavosToPesos = (centavos: number) => String(Math.floor(centavos / 100));

/** Reads CREOMS's answer; null when it is not a full set. */
export function parseAutomaticChecks(value: unknown): AutomaticChecks | null {
  const v = value as AutomaticChecks | null;
  if (!v || typeof v !== "object") return null;
  return v.paymentProof && v.cod && v.returns && v.dashboard ? v : null;
}
