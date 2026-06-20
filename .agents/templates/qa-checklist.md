# QA Smoke Checklist

Use this after implementation and before release.

## Auth / Session

- [ ] Login works
- [ ] Logout works
- [ ] HUB launch works
- [ ] SSO redirect works
- [ ] Expired or revoked session fails correctly

## Site Scope

- [ ] Single-site user only sees assigned data
- [ ] Multi-site user can switch among assigned sites
- [ ] All-sites user sees cross-site data only when expected
- [ ] New records are written to the selected site
- [ ] Switching site updates the page data correctly

## CRUD

- [ ] Create works
- [ ] Edit works
- [ ] Delete works
- [ ] Saved data appears immediately
- [ ] Deleted data disappears immediately

## Form / UI

- [ ] Required fields validate before submit
- [ ] Date/calendar fields are usable in current theme
- [ ] Buttons are visible and styled correctly
- [ ] Modal opens/closes correctly
- [ ] No broken loading/error states

## Data Integrity

- [ ] Field names match backend schema
- [ ] No wrong-site writes
- [ ] No stale cards/tables after mutation

