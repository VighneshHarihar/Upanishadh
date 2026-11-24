// The printed frame every Living Plate shares: a hairline double rule, a plate number, a title and its source.
import Link from "next/link";
import "./plates.css";

export function PlateFrame({
  numeral,
  title,
  source,
  level = 2,
  className = "",
  children,
}: {
  numeral: string;
  title: string;
  source: React.ReactNode;
  level?: 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={`lp ${className}`}>
      <div className="lp-frame">
        <header className="lp-head">
          <p className="lp-eyebrow">
            <span>Plate {numeral}</span>
            <span className="lp-eyebrow-src">{source}</span>
          </p>
          <div role="heading" aria-level={level} className="lp-title">{title}</div>
        </header>
        {children}
      </div>
    </figure>
  );
}

/** Small "Read KaU 1.3.3 →" link. */
export function ReadLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={`lp-read ${className}`}>
      Read {label} <span aria-hidden="true">→</span>
    </Link>
  );
}
