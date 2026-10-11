/** Server-owned demo selection; no client header or request body can select a write profile. */
export type DemoProfile = "rich" | "legacy";
export function demoProfile(): DemoProfile {
  const value=process.env.MRI_DEMO_PROFILE ?? "rich";
  if(value!=="rich" && value!=="legacy") throw new Error("MRI_DEMO_PROFILE must be rich or legacy");
  return value;
}
