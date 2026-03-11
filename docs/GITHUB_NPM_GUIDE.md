# Aitri — Release Flow

> Operational reference. Follow this exactly before every release.

---

## Release checklist

```bash
# 1. Run full test suite — must be 0 failures
npm run test:all

# 2. Bump version in both files (must stay in sync):
#    - package.json  → "version": "x.x.x"
#    - bin/aitri.js  → const VERSION = 'x.x.x'

# 3. Verify install and version
npm i -g .
aitri --version   # must match the bumped version

# 4. Commit and push
git add bin/ lib/ templates/ test/ docs/ package.json README.md
git commit -m "vX.X.X — <summary>"
git push
```

That's the full release. No tag required unless publishing to npm.

---

## Version policy

| Change type | Bump |
|---|---|
| Bug fixes, briefing wording, test additions | `patch` |
| New commands, new validation rules, new phases | `minor` |
| Breaking schema changes, removed commands | `major` |

```bash
npm version patch --no-git-tag-version   # then sync bin/aitri.js manually
```

---

## npm publish (when ready)

```bash
npm login
npm publish --dry-run    # review what gets published
npm publish --access public
git tag vX.X.X && git push origin main --tags
```

**Files published** (controlled by `package.json > files`):
```
bin/  lib/  templates/  README.md  LICENSE
```

`docs/`, `test/`, `.claude/` are NOT published.

---

## When to add CI/CD

Not needed while solo. Add GitHub Actions when:
- A second contributor opens PRs
- npm publish is automated on tag
