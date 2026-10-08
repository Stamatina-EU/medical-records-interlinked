"use client";
/**
 * App navigation — one system, two presentations:
 *  - desktop: a sidebar carrying the MRI identity (mark + descriptor) and the patient who owns the space
 *  - mobile: a top bar with the brand + a bottom tab bar with comfortable touch targets
 * Destinations: Home (the Snapshot) · History · Doctor Summary.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, HomeIcon, SummaryIcon } from "./icons";
import styles from "./shell.module.css";

const ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/history/iron", label: "History", Icon: HistoryIcon, match: (p: string) => p.startsWith("/history") },
  { href: "/summary", label: "Doctor Summary", Icon: SummaryIcon, match: (p: string) => p.startsWith("/summary") },
];

function Brand() {
  return (
    // Primary mark + descriptor only; the tagline is a presentation line, not part of the nav shell.
    // The mark is an outlined SVG (public/brand/mark.svg); the link's aria-label names it, so the image is decorative.
    <Link href="/" className={styles.brand} aria-label="MRI, Medical Records Interlinked, home">
      <img src="/brand/mark.svg" alt="" width={166} height={52} className={styles.mark} />
      <span className={styles.descriptor}>Medical Records Interlinked</span>
    </Link>
  );
}

export default function AppNav({ patientName }: { patientName: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <Brand />
        <nav aria-label="Primary" className={styles.sideNav}>
          {ITEMS.map(({ href, label, Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={active ? `${styles.sideItem} ${styles.sideItemActive}` : styles.sideItem}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.owner}>
          <span className={styles.ownerName}>{patientName}</span>
          <span className={styles.ownerNote}>Synthetic demo record</span>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className={styles.topbar}>
        <Brand />
      </header>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary" className={styles.tabbar}>
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              aria-current={active ? "page" : undefined}
            >
              <Icon />
              <span>{label === "Doctor Summary" ? "Summary" : label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
