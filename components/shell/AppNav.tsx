"use client";
/** Four destinations: compact desktop navigation and labelled mobile tabs. */
import AddRecord from "@/components/add-record/AddRecord";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, HomeIcon, SummaryIcon, DocIcon } from "./icons";
import styles from "./shell.module.css";

const ITEMS = [
  {
    href: "/",
    label: "Record",
    Icon: HomeIcon,
    match: (p: string) => p === "/",
  },
  {
    href: "/history/iron",
    label: "History",
    Icon: HistoryIcon,
    match: (p: string) => p.startsWith("/history"),
  },
  {
    href: "/sources",
    label: "Sources",
    Icon: DocIcon,
    match: (p: string) => p.startsWith("/sources"),
  },
  {
    href: "/summary",
    label: "Doctor Summary",
    Icon: SummaryIcon,
    match: (p: string) => p.startsWith("/summary"),
  },
];

function Brand() {
  return (
    // Primary mark + descriptor only; the tagline is a presentation line, not part of the nav shell.
    // The mark is an outlined SVG (public/brand/mark.svg); the link's aria-label names it, so the image is decorative.
    <Link
      href="/"
      className={styles.brand}
      aria-label="MRi, Medical Records Interlinked, record"
    >
      <img
        src="/brand/mark.svg"
        alt=""
        width={166}
        height={52}
        className={styles.mark}
      />
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
                className={
                  active
                    ? `${styles.sideItem} ${styles.sideItemActive}`
                    : styles.sideItem
                }
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        {pathname !== "/" && (
          <div className={styles.navAction}>
            <AddRecord />
          </div>
        )}
        <div className={styles.owner}>
          <span className={styles.ownerName}>{patientName}</span>
          <span className={styles.ownerNote}>Synthetic demo record</span>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className={styles.topbar}>
        <Brand />
        {pathname !== "/" && (
          <div className={styles.mobileAction}>
            <AddRecord />
          </div>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary" className={styles.tabbar}>
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={
                active ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
              aria-current={active ? "page" : undefined}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
