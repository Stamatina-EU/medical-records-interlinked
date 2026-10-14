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

function Brand({ inverse = false, href = "/" }: { inverse?: boolean; href?: string }) {
  return (
    // The dark-header lockup includes the outlined descriptor.
    // The link's aria-label names the brand, so the image is decorative.
    <Link
      href={href}
      className={styles.brand}
      aria-label="MRi, Medical Records Interlinked, record"
    >
      <img
        src={inverse ? "/brand/mri-lockup-on-dark.svg" : "/brand/mark.svg"}
        alt=""
        width={inverse ? 494.55 : 166}
        height={inverse ? 185.92 : 52}
        className={inverse ? styles.lockup : styles.mark}
      />
      {!inverse && (
        <span className={styles.descriptor}>Medical Records Interlinked</span>
      )}
    </Link>
  );
}

export default function AppNav({ patientName, demoProfile="legacy" }: { patientName: string;demoProfile?:"rich"|"legacy" }) {
  const pathname = usePathname() ?? "/";
  const study = pathname === "/rich" || pathname.startsWith("/rich/");
  const rich=study || demoProfile==="rich";
  const base=study ? "/rich" : "";
  const activePath = study ? (pathname.slice(5) || "/") : pathname;
  const items = rich ? ITEMS.map(item => ({ ...item, href: item.href === "/history/iron" ? base+"/history" : (item.href === "/" ? (base || "/") : base + item.href), match: item.label === "History" ? (p: string) => p.startsWith("/history") || p.startsWith("/laboratory") : item.match })) : ITEMS;
  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`${styles.sidebar} ${styles.recordNav}`}>
        <Brand inverse href={study ? "/rich" : "/"} />
        <nav aria-label="Primary" className={styles.sideNav}>
          {items.map(({ href, label, Icon, match }) => {
            const active = match(activePath);
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
        {!study && (pathname !== "/" || demoProfile === "rich") && (
          <div className={styles.navAction}>
            <AddRecord />
          </div>
        )}
        <div className={styles.owner}>
          <span className={styles.ownerName}>{patientName}</span>
          <span className={styles.ownerNote}>{study ? "Read-only rich synthetic demo" : "Synthetic demo record"}</span>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className={`${styles.topbar} ${styles.recordNav}`}>
        <Brand inverse href={study ? "/rich" : "/"} />
        {!study && pathname !== "/" && (
          <div className={styles.mobileAction}>
            <AddRecord />
          </div>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary" className={`${styles.tabbar} ${styles.recordNav}`}>
        {items.map(({ href, label, Icon, match }) => {
          const active = match(activePath);
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
