## Summary

<!-- One or two sentences. What does this PR change and why? -->

## Related issue(s)

<!-- Closes #123 / Refs #456 / N/A -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Tests
- [ ] Build / CI / chore

## Testing

- [ ] `npm run lint` clean
- [ ] `npx vue-tsc --noEmit` clean
- [ ] `npm run test:unit` passes
- [ ] `npm run test:e2e` passes (or scope confirmed unaffected)
- [ ] `npm run build` passes
- [ ] Runtime tested in browser (for UI/UX changes)

> The Husky `pre-push` hook runs `npm run check-all` (lint + typecheck + unit + e2e) automatically. Skip selectively with `npm run check-all -- --skip=e2e` when needed.

## Conventional commit

- [ ] Subject follows `type(scope): description` with a scope from `commitlint.config.mjs`
- [ ] If touching i18n, all 5 locales (it/en/de/fr/es) are updated
- [ ] If touching persisted data, backward compatibility is preserved or migration is documented

## Screenshots / recordings (UI changes)

<!-- Drag-drop images or paste links. Mobile + desktop where relevant. -->

## Notes for reviewer

<!-- Anything non-obvious: trade-offs, follow-up work, linked spike/audit. -->
