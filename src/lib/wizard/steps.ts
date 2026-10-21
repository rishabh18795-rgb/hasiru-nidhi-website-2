/** The listing wizard, in order. Every step is a real, persisted section of the draft listing. */
export const WIZARD_STEPS = [
  { key: "type", label: "Property type", short: "Type" },
  { key: "location", label: "Location", short: "Location" },
  { key: "details", label: "Property details", short: "Details" },
  { key: "photos", label: "Photographs", short: "Photos" },
  { key: "amenities", label: "Facilities & experiences", short: "Facilities" },
  { key: "pricing", label: "Pricing", short: "Pricing" },
  { key: "availability", label: "Availability", short: "Calendar" },
  { key: "review", label: "Policies & review", short: "Review" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export function isStepKey(v: unknown): v is WizardStepKey {
  return typeof v === "string" && WIZARD_STEPS.some((s) => s.key === v);
}

export function stepIndex(key: WizardStepKey): number {
  return WIZARD_STEPS.findIndex((s) => s.key === key);
}

export function nextStep(key: WizardStepKey): WizardStepKey | null {
  return WIZARD_STEPS[stepIndex(key) + 1]?.key ?? null;
}

export function previousStep(key: WizardStepKey): WizardStepKey | null {
  return WIZARD_STEPS[stepIndex(key) - 1]?.key ?? null;
}

export const wizardPath = (propertyId: string, key: WizardStepKey) => `/host/properties/${propertyId}/wizard/${key}`;
