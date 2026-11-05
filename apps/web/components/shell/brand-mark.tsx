import { useId } from "react";

/** VAYU's mark (the same orb-and-ring as the app icon). Decorative; label the link around it. */
export function BrandMark({ className }: { className?: string }) {
  // A per-instance gradient id: with a shared id, `url(#…)` resolves to the first mark on the
  // page, and if that one sits in a hidden subtree every other mark loses its fill.
  const gradient = `vayu-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <radialGradient id={gradient} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3b0764" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="17" fill={`url(#${gradient})`} />
      <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="3" />
    </svg>
  );
}
