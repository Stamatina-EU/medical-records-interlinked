"use client";
/** Top Navigation — Snapshot · History · Doctor Summary. Spec: `spec.md > Top Navigation`. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./nav.module.css";

const ITEMS = [
  { href: "/", label: "Snapshot", match: (p: string) => p === "/" },
  { href: "/history/iron", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/summary", label: "Doctor Summary", match: (p: string) => p.startsWith("/summary") },
];

export default function TopNav() {
  const pathname = usePathname() ?? "/";
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Medical History
        </Link>
        <nav aria-label="Primary">
          <ul className={styles.items}>
            {ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={active ? `${styles.item} ${styles.active}` : styles.item}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
