// Command-line arguments: positionals, --key value, --key=value, and boolean flags.
export const FLAGS = new Set(["json", "no-html", "quiet", "help", "version", "no-color", "full", "offline", "fresh"]);
export function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const opt: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h") opt.help = true;
    else if (a === "-v") opt.version = true;
    else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const k = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) opt[k] = a.slice(eq + 1);
      else if (!FLAGS.has(k) && i + 1 < argv.length && !argv[i + 1].startsWith("--")) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}
