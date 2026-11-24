// Dynamic OpenGraph images: /og?t=<title>&s=<subtitle>[&up=<upanishad id>][&r=<root line>], set as the same engraved
// plate as the share card: parchment ground, a double hairline border, the Upanishad's emblem when `up` names one, and
// the Veda-Sāra root in gold at the foot. Latin script only (the image renderer cannot shape Devanagari conjuncts
// correctly), in Source Serif with full IAST diacritics fetched for exactly the text drawn.
import { ImageResponse } from "next/og";
import { EMBLEM_IDS, emblemDataUrl } from "@/components/art/UpanishadEmblem";

export const runtime = "edge";
const W = 1200;
const H = 630;
const INK = { ground: "#f3ede1", ink: "#221d15", ink2: "#4a4234", ink3: "#7b6f5b", rule: "rgba(34,29,21,0.5)", soft: "rgba(34,29,21,0.2)", gold: "#8a5a12" };

async function font(family: string, weight: number, text: string, italic = false): Promise<ArrayBuffer | null> {
  try {
    const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/[\s,;:.—–-]*\S*$/, "")}…` : s);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams;
  const up = q.get("up") ?? "";
  const emblem = EMBLEM_IDS.includes(up) ? emblemDataUrl(up, { stroke: INK.ink, accent: INK.gold, size: 196, weight: 1.8 }) : "";
  const title = clip(q.get("t") || "UpaSārathi", emblem ? 44 : 60);
  const sub = clip(q.get("s") || "Modern AI is trained to please you. The Upanishads were written to wake you up.", emblem ? 190 : 230);
  const root = clip(q.get("r") || "The thirteen Principal Upanishads, rooted in their Vedas", 80);
  const imprint = "UPASĀRATHI";
  const head = "Sit near the Upanishads";
  const host = u.host.replace(/^www\./, "");
  const latin = `${title}${sub}${root}${imprint}${head}${host}“”…·`;
  const [serif, serifBold, serifItalic, sans] = await Promise.all([font("Source Serif 4", 400, latin), font("Source Serif 4", 600, latin), font("Source Serif 4", 400, latin, true), font("Inter", 600, latin)]);
  const fonts = [
    ...(serif ? [{ name: "Serif", data: serif, weight: 400 as const, style: "normal" as const }] : []),
    ...(serifBold ? [{ name: "Serif", data: serifBold, weight: 600 as const, style: "normal" as const }] : []),
    ...(serifItalic ? [{ name: "Serif", data: serifItalic, weight: 400 as const, style: "italic" as const }] : []),
    ...(sans ? [{ name: "Sans", data: sans, weight: 600 as const, style: "normal" as const }] : []),
  ];
  const hair = (o: React.CSSProperties = {}) => <div style={{ display: "flex", background: INK.soft, ...o }} />;
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: INK.ground, color: INK.ink, fontFamily: serif ? "Serif" : undefined }}>
        <div style={{ position: "absolute", top: 24, left: 24, width: W - 48, height: H - 48, border: `1.5px solid ${INK.rule}`, display: "flex" }} />
        <div style={{ position: "absolute", top: 32, left: 32, width: W - 64, height: H - 64, border: `1px solid ${INK.soft}`, display: "flex" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", flexDirection: "column", padding: "60px 72px 52px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: sans ? "Sans" : undefined, fontWeight: 600, fontSize: 13, letterSpacing: "0.26em", color: INK.ink3 }}>{imprint}</div>
            <div style={{ fontStyle: "italic", fontSize: 19, color: INK.ink2 }}>{head}</div>
          </div>
          {hair({ height: 1, marginTop: 20 })}
          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
            {emblem && (
              <div style={{ display: "flex", alignItems: "center", alignSelf: "stretch" }}>
                <div style={{ display: "flex", width: 240, justifyContent: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emblem} width={196} height={196} alt="" />
                </div>
                {hair({ width: 1, alignSelf: "stretch", margin: "34px 46px 34px 30px" })}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
              <div style={{ fontWeight: 600, fontSize: emblem ? (title.length > 26 ? 52 : 62) : title.length > 30 ? 64 : 80, lineHeight: 1.06, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: emblem ? 29 : 31, lineHeight: 1.42, color: INK.ink2 }}>{sub}</div>
            </div>
          </div>
          {hair({ height: 1 })}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 }}>
            <div style={{ fontStyle: "italic", fontSize: 20, color: INK.gold }}>{root}</div>
            <div style={{ fontFamily: sans ? "Sans" : undefined, fontWeight: 600, fontSize: 13, letterSpacing: "0.08em", color: INK.ink3 }}>{host}</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined },
  );
}
