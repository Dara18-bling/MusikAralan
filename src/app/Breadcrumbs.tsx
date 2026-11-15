import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-mute" aria-hidden="true" />
              )}
              {item.onClick && !current ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="truncate font-medium text-p1 hover:underline"
                >
                  {item.label}
                </button>
              ) : item.href && !current ? (
                <Link
                  to={item.href}
                  className="truncate font-medium text-p1 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={current ? "page" : undefined}
                  className={`truncate ${current ? "font-semibold text-ink" : "text-mute"}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
