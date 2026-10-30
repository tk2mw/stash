// Shared motion presets, so everything moves with the same feel.
export const spring = {
  // layout moves, panels, list items: settles without overshoot
  smooth: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  // buttons, chips, small UI reacting to a press or hover
  snappy: { type: "spring", stiffness: 420, damping: 32 },
  // sliding highlights (active nav, chips, rows)
  glide: { type: "spring", stiffness: 380, damping: 36, mass: 0.8 },
  // playful "pop" for stars, hearts, badges
  bouncy: { type: "spring", stiffness: 520, damping: 15 },
} as const;

export const ease = [0.32, 0.72, 0, 1] as const;
