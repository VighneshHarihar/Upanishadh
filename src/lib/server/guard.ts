// Requests made to and from this machine only (loopback Host, same-origin Origin, no non-loopback proxy hop).
// Server-side keys and custom endpoints serve local requests only, so a deployment is never an open relay and
// visitors never spend the owner's key.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalRequest(req: Request): boolean {
  let host: string | null = null;
  try {
    host = new URL(`http://${req.headers.get("host") ?? ""}`).hostname;
  } catch {
    return false;
  }
  if (!host || !LOOPBACK.has(host)) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (!LOOPBACK.has(new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }
  const fwd = req.headers.get("x-forwarded-for");
  return !fwd || fwd.split(",").every((ip) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip.trim()));
}
