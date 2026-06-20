# Release Checklist

## Pre-Deploy

- [ ] Builds pass
- [ ] Syntax checks pass
- [ ] Relevant tests pass
- [ ] Migration reviewed
- [ ] Environment variables confirmed
- [ ] App URLs / SSO redirects confirmed

## Database

- [ ] Target database confirmed
- [ ] Backup taken if needed
- [ ] Migration order confirmed
- [ ] Seed/backfill requirements documented

## Deploy

- [ ] Image built
- [ ] Image tag recorded
- [ ] App deployed
- [ ] Logs checked for startup errors

## Post-Deploy

- [ ] HUB login works
- [ ] App launch from HUB works
- [ ] Site selector works
- [ ] Create/edit/delete smoke test works
- [ ] Logout works
- [ ] No critical console/server errors

## Rollback

- [ ] Prior image tag known
- [ ] Rollback command documented
