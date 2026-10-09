import type { CSSProperties } from "react";
import styles from "./visualIcon.module.css";

type IconName =
  | "flask-conical"
  | "scan-line"
  | "pill"
  | "files"
  | "network"
  | "clipboard-list"
  | "notebook-tabs"
  | "chart-no-axes-combined"
  | "arrow-up-right";
/** Decorative official Lucide glyphs; source files and license are in public/visual-icons. */
export default function VisualIcon({
  name,
  size = 24,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    maskImage: `url("/visual-icons/${name}.svg")`,
    WebkitMaskImage: `url("/visual-icons/${name}.svg")`,
  };
  return (
    <span
      aria-hidden="true"
      className={`${styles.icon} ${className}`}
      style={style}
    />
  );
}
