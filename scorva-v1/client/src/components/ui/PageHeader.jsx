/**
 * Page header with title, description, and action slot.
 */
export default function PageHeader({ title, description, action }) {
  return (
    <div className="sc-page-header">
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
