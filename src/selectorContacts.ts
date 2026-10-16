import type { DeviceParams } from "./types";

/**
 * F-O-R (selector-3) cam contact.
 * Position 0 is Off, 1 is F, 2 is R.
 * NO closes only in its own position. NC opens only in its own position.
 * An omitted type is NO, so existing drawings stay make-only.
 */
export function selector3ContactClosed(
  which: "f" | "r",
  position: number | undefined,
  params: DeviceParams | undefined,
): boolean {
  const pos = position ?? 0;
  if (which === "f") return params?.fwdContact === "nc" ? pos !== 1 : pos === 1;
  return params?.revContact === "nc" ? pos !== 2 : pos === 2;
}
