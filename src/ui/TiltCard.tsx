import type { ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { cx } from "./cx";

// Card that leans toward the pointer in 3D with a soft light following it. Purely decorative motion.
export function TiltCard({ children, className, max = 9 }: { children: ReactNode; className?: string; max?: number }) {
  const config = { stiffness: 220, damping: 22, mass: 0.6 };
  const rx = useSpring(0, config);
  const ry = useSpring(0, config);
  const lift = useSpring(0, config);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const shine = useSpring(0, config);
  const light = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.28), transparent 55%)`;

  return (
    <motion.div
      onPointerMove={(e) => {
        if (e.pointerType === "touch") return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * max * 2);
        rx.set(-(py - 0.5) * max * 2);
        gx.set(px * 100);
        gy.set(py * 100);
        shine.set(1);
        lift.set(-4);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
        shine.set(0);
        lift.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, y: lift, transformPerspective: 700 }}
      className={cx("relative [transform-style:preserve-3d]", className)}
    >
      {children}
      <motion.span aria-hidden style={{ backgroundImage: light, opacity: shine }} className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light" />
    </motion.div>
  );
}
