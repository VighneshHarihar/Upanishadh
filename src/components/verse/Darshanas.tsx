// "Compare darśanas": how Advaita (Śaṅkara), Viśiṣṭādvaita (Rāmānuja) and Dvaita (Madhva) read a landmark passage,
// side by side. Editorial summaries with their sources, labelled as such. Pure markup; a <details> disclosure.
export type SchoolId = "advaita" | "vishishtadvaita" | "dvaita";
export interface DarshanaData {
  _about: string;
  schools: Record<SchoolId, { label: string; teacher: string; gloss: string }>;
  passages: ({ verse: string; kw: string; theme: string } & Record<SchoolId, { text: string; source: string }>)[];
}
const ORDER: SchoolId[] = ["advaita", "vishishtadvaita", "dvaita"];

export function Darshanas({ data, verse }: { data: DarshanaData; verse: string }) {
  const p = data.passages.find((x) => x.verse === verse);
  if (!p) return null;
  return (
    <details className="darshanas mt-4 border-t border-line-2 pt-5" open>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="text-[15px] font-semibold">Compare darśanas <span className="font-normal text-text-3">· {p.theme}</span></span>
        <span className="text-[12.5px] text-text-3">Śaṅkara · Rāmānuja · Madhva</span>
      </summary>
      <div className="mt-5 grid gap-px overflow-hidden rounded-[2px] border border-line bg-[var(--line)] lg:grid-cols-3">
        {ORDER.map((s) => (
          <section key={s} className="bg-[var(--bg)] p-5" aria-label={data.schools[s].label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">{data.schools[s].label}</p>
            <p className="mt-0.5 text-[12.5px] text-text-3">{data.schools[s].teacher} · {data.schools[s].gloss}</p>
            <p className="reading mt-3 text-[15.5px] leading-[1.65]">{p[s].text}</p>
            <p className="mt-3 border-t border-line pt-2 text-[12px] text-text-3">{p[s].source}</p>
          </section>
        ))}
      </div>
      <p className="mt-3 max-w-[80ch] text-[12px] leading-relaxed text-text-4">
        Editorial summaries of each school’s standard reading, written for this site; not translations. Rāmānuja wrote no separate commentary on the Upaniṣads, so his readings are drawn from the Śrī Bhāṣya and the Vedārthasaṅgraha.
      </p>
    </details>
  );
}
