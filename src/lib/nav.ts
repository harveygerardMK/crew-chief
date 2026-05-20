export type NavItem = { href: string; label: string };

/** Top-level nav: single links or labeled groups (dropdown). */
export type NavEntry =
  | { type: "link"; item: NavItem }
  | { type: "group"; label: string; items: NavItem[] };

export const navEntries: NavEntry[] = [
  { type: "link", item: { href: "/", label: "Home" } },
  {
    type: "group",
    label: "Crew",
    items: [
      { href: "/next/", label: "Next stop" },
      { href: "/board/", label: "Race board" },
      { href: "/crew/", label: "Crew guide" },
      { href: "/aid-stations/", label: "Aid stations" },
    ],
  },
  {
    type: "group",
    label: "Plan",
    items: [
      { href: "/course/", label: "Course" },
      { href: "/gear/", label: "Gear" },
      { href: "/schedule/", label: "Schedule" },
    ],
  },
  { type: "link", item: { href: "/pacers/", label: "Pacers" } },
  { type: "link", item: { href: "/follow/", label: "See Harvey" } },
];

export function normalizePath(path: string): string {
  const p = path.replace(/\/$/, "") || "/";
  return p;
}

export function isNavItemActive(canonicalPath: string, href: string): boolean {
  const p = normalizePath(canonicalPath);
  const target = normalizePath(href);
  if (target === "/") return p === "/";
  return p === target || p.startsWith(`${target}/`);
}

export function isGroupActive(canonicalPath: string, items: NavItem[]): boolean {
  return items.some((item) => isNavItemActive(canonicalPath, item.href));
}

export function hrefWithBase(base: string, href: string): string {
  return `${base}${href === "/" ? "" : href.slice(1)}`;
}
