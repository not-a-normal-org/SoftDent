import Link from "next/link";

/**
 * Page links for a URL-driven list: first, last, and the pages around the current
 * one, with gaps shown as "…". The page builds each href, so the link carries the
 * list's other filters along.
 */
export default function Pager({ page, pages, href, label = "Pages" }: {
  page: number; pages: number; href: (n: number) => string; label?: string;
}) {
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])]
    .filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = "grid h-8 min-w-8 place-items-center rounded-md px-2 text-xs tabular-nums";
  const idle = `${btn} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {page > 1
        ? <Link href={href(page - 1)} className={idle} aria-label="Previous page">‹</Link>
        : <span className={`${btn} text-slate-300 dark:text-slate-600`}>‹</span>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
          {n === page
            ? <span className={`${btn} bg-teal-600 font-medium text-white`} aria-current="page">{n}</span>
            : <Link href={href(n)} className={idle}>{n}</Link>}
        </span>
      ))}
      {page < pages
        ? <Link href={href(page + 1)} className={idle} aria-label="Next page">›</Link>
        : <span className={`${btn} text-slate-300 dark:text-slate-600`}>›</span>}
    </nav>
  );
}
