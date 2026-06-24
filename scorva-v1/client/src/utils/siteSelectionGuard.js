export function canManageAllSites(user) {
  return (
    Boolean(user?.canSeeAllSites) ||
    user?.hubRole === 'Hub Admin' ||
    user?.role === 'Hub Admin' ||
    user?.role === 'Corporate Admin'
  );
}

export function requiresExplicitSiteSelection(user, selectedSite) {
  return canManageAllSites(user) && !selectedSite;
}

export function isAllSitesView(user, selectedSite) {
  return requiresExplicitSiteSelection(user, selectedSite);
}

export function getRecordSiteLabel(record) {
  return (
    record?.siteId ||
    record?.siteID ||
    record?.site_id ||
    record?.site ||
    record?.primarySiteId ||
    '—'
  );
}

export function guardSiteScopedCreate({ user, selectedSite, entityLabel = 'record' }) {
  if (!requiresExplicitSiteSelection(user, selectedSite)) return true;

  window.alert(`Choose a site from the header before creating a new ${entityLabel}.`);
  return false;
}
