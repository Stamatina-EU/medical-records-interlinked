/**
 * Local mutation guard — local proof-of-concept hardening, not authentication.
 * State-changing endpoints (extract, cancel, apply) accept a browser request only from this app's own local
 * origin, so a page on another site — or on another port of this machine — cannot make the browser start an
 * extraction, discard a pending proposal or approve one. Browsers send `Origin` on every POST; a request with no
 * `Origin` at all (curl, a script on this machine) is not a cross-site browser request and is allowed.
 * Checked before any work is done; the response is generic and reveals nothing.
 */
import { NextResponse } from "next/server";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const port = (u: URL) => u.port || (u.protocol === "https:" ? "443" : "80");

/** A 403 for a request that comes from a foreign origin; `null` when the request may proceed. */
export function rejectForeignOrigin(req: Request): Response | null {
  const forbidden = () => NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return forbidden();
  const origin = req.headers.get("origin");
  if (origin === null) return null;
  let from: URL;
  let self: URL;
  try {
    from = new URL(origin); // "null" (sandboxed frames, file pages) does not parse and is rejected
    self = new URL(req.url);
  } catch {
    return forbidden();
  }
  const local =
    (from.protocol === "http:" || from.protocol === "https:") &&
    LOOPBACK.has(from.hostname) &&
    LOOPBACK.has(self.hostname) &&
    port(from) === port(self);
  return local ? null : forbidden();
}
