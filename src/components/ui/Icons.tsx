// Stroke icons (no icon dependency).
type P = { size?: number; className?: string };
const base = (size = 16) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconPlay = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" /></svg>);
export const IconPause = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M8 5v14M16 5v14" /></svg>);
export const IconArrow = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconBack = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const IconExternal = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const IconClose = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconKey = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></svg>);
export const IconSun = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IconMoon = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
export const IconCheck = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12.5l4.5 4.5L19 7" /></svg>);
export const IconAlert = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>);
export const IconReplay = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></svg>);
export const IconOrbit = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="2.5" /><ellipse cx="12" cy="12" rx="10" ry="4.2" /><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" /></svg>);
export const IconBook = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H3z" /><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H21z" /></svg>);
export const IconRoute = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" /></svg>);
export const IconScale = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" /></svg>);
export const IconSearch = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
export const IconChat = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 5h16v11H9l-5 4z" /></svg>);
export const IconDownload = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></svg>);
export const IconEye = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IconEyeOff = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
export const IconPlus = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12h14" /></svg>);
export const IconFit = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const IconSend = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconTrash = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const IconLayers = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>);
export const IconTerminal = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></svg>);
export const IconCopy = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>);
export const IconFile = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></svg>);
export const IconHome = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>);
export const IconMap = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="5" cy="6" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M7 7l3.8 9M17 7l-3.8 9M7.2 6h9.6" /></svg>);
export const IconBookmark = ({ size, className, filled }: P & { filled?: boolean }) => (<svg {...base(size)} className={className}><path d="M6 3h12v18l-6-4.5L6 21z" fill={filled ? "currentColor" : "none"} /></svg>);
export const IconShare = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></svg>);
export const IconLoop = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>);
export const IconNext = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M6 5l10 7-10 7z" fill="currentColor" stroke="none" /><path d="M18 5v14" /></svg>);
export const IconPrev = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M18 5L8 12l10 7z" fill="currentColor" stroke="none" /><path d="M6 5v14" /></svg>);
export const IconNote = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></svg>);
export const IconInfo = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>);

/** The brand mark: a chariot wheel (the Kaṭha's chariot) with the self at its hub. */
export const Mark = ({ size = 26, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
    <circle cx="16" cy="16" r="13" fill="none" stroke="var(--gold)" strokeWidth="1.6" />
    <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent)" strokeWidth="1" opacity=".55" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return <line key={i} x1={16 + Math.cos(a) * 3.2} y1={16 + Math.sin(a) * 3.2} x2={16 + Math.cos(a) * 12.4} y2={16 + Math.sin(a) * 12.4} stroke="var(--gold)" strokeWidth="1" opacity=".7" />;
    })}
    <circle cx="16" cy="16" r="2.6" fill="var(--accent)" />
  </svg>
);
