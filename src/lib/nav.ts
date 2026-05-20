export type PrimaryNavItem = {
  href: string;
  label: string;
  /** Path prefixes that mark this tab active (e.g. /next under Crew). */
  activePrefixes: string[];
};

export const primaryNav: PrimaryNavItem[] = [
  { href: "/", label: "Home", activePrefixes: ["/"] },
  {
    href: "/crew/",
    label: "Crew",
    activePrefixes: ["/crew", "/next", "/board", "/aid-stations"],
  },
  { href: "/pacers/", label: "Pacers", activePrefixes: ["/pacers"] },
  {
    href: "/plan/",
    label: "Plan",
    activePrefixes: ["/plan", "/course", "/gear", "/schedule"],
  },
];

export function normalizePath(path: string): string {
  const p = path.replace(/\/$/, "") || "/";
  return p;
}

export function isPrimaryNavActive(canonicalPath: string, item: PrimaryNavItem): boolean {
  const p = normalizePath(canonicalPath);
  if (item.href === "/") return p === "/";
  return item.activePrefixes.some((prefix) => {
    const key = normalizePath(prefix);
    return p === key || p.startsWith(`${key}/`);
  });
}

export function hrefWithBase(base: string, href: string): string {
  return `${base}${href === "/" ? "" : href.slice(1)}`;
}
