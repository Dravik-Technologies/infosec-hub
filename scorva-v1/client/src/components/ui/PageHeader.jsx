import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Page header with optional breadcrumbs, title, description, and action slot.
 *
 * breadcrumbs – array of { label, to? } objects; last item is current page (no link)
 */
export default function PageHeader({ title, description, action, breadcrumbs }) {
  return (
    <div className="sc-page-header">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="sc-breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight size={10} className="text-scorva-muted/30 shrink-0" />}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="text-scorva-muted hover:text-scorva-text transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-scorva-muted">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="sc-page-header-row">
        <div className="min-w-0 flex-1">
          <h1 className="sc-page-title">
            {title}
          </h1>
          {description && (
            <p className="sc-page-desc">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="shrink-0 flex items-center gap-3 sc-page-actions">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
