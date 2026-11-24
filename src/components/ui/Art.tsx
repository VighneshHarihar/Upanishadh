// Cinematic painted bands. If public/images/<name>.(webp|jpg|png) exists it is used (with an optional portrait
// version for phones); otherwise an atmospheric gradient stands in, so every page is finished before the art arrives.
import { existsSync } from "node:fs";
import { join } from "node:path";

const EXT = ["webp", "jpg", "jpeg", "png"];
export function artSrc(name: string): string | null {
  for (const ext of EXT) if (existsSync(join(process.cwd(), "public", "images", `${name}.${ext}`))) return `/images/${name}.${ext}`;
  return null;
}

export function Art({ name, portrait, alt, shade = "left", className = "", imgClassName = "", position, children, eager = false }: {
  name: string;
  portrait?: string;
  alt: string;
  shade?: "left" | "center" | "light" | "bottom" | "none";
  className?: string;
  imgClassName?: string;
  /** CSS object-position, to keep the subject in frame as the band crops. */
  position?: string;
  children?: React.ReactNode;
  eager?: boolean;
}) {
  const src = artSrc(name);
  const tall = portrait ? artSrc(portrait) : null;
  return (
    <div className={`art ${className}`}>
      {src ? (
        <picture>
          {tall && <source media="(max-width: 720px)" srcSet={tall} />}
          <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} className={`absolute inset-0 -z-20 h-full w-full object-cover ${imgClassName}`} style={position ? { objectPosition: position } : undefined} />
        </picture>
      ) : (
        <div className="art-fallback" role="img" aria-label={alt} />
      )}
      {shade === "left" && <div className="art-shade" />}
      {shade === "center" && <div className="art-shade-center" />}
      {shade === "light" && <div className="art-shade-light" />}
      {shade === "bottom" && <div className="art-shade-bottom" />}
      {children}
    </div>
  );
}
