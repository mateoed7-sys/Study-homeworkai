interface Props {
  /** 0–1. Fraction of answered questions the student got right. */
  ratio: number;
  active: boolean;
}

const TOP = 8;
const BOTTOM = 60;
const INNER_HEIGHT = BOTTOM - TOP;

/** A little test tube that fills with the student's score. */
export default function Vial({ ratio, active }: Props) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const height = active ? INNER_HEIGHT * clamped : 0;
  const fill = !active ? 'transparent' : clamped >= 0.7 ? '#5f7543' : clamped >= 0.4 ? '#c9a227' : '#8c3636';

  return (
    <svg
      className="vial"
      width="30"
      height="66"
      viewBox="0 0 30 66"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="vial-bore">
          <rect x="9" y={TOP} width="12" height={INNER_HEIGHT} rx="6" />
        </clipPath>
      </defs>

      {/* liquid */}
      <rect
        className="vial-fill"
        x="9"
        y={BOTTOM - height}
        width="12"
        height={height}
        fill={fill}
        clipPath="url(#vial-bore)"
      />

      {/* glass */}
      <rect
        x="8"
        y="7"
        width="14"
        height={INNER_HEIGHT + 2}
        rx="7"
        fill="none"
        stroke="rgba(236,224,196,0.45)"
        strokeWidth="1.25"
      />
      {/* lip */}
      <line x1="6" y1="6" x2="24" y2="6" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" />
      {/* graduations */}
      <line x1="18" y1="20" x2="22" y2="20" stroke="rgba(236,224,196,0.28)" strokeWidth="1" />
      <line x1="18" y1="34" x2="22" y2="34" stroke="rgba(236,224,196,0.28)" strokeWidth="1" />
      <line x1="18" y1="48" x2="22" y2="48" stroke="rgba(236,224,196,0.28)" strokeWidth="1" />
    </svg>
  );
}
