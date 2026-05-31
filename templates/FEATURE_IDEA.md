<!-- AGENT: if you fill this for the user, confirm the ground-truth fields
     (Problem / Why, Target Users, Success Criteria, Out of Scope) with them —
     do not silently infer. Mark anything you inferred as "[ASSUMPTION] …".
     Phase 1 records these as a provenance contract and blocks unconfirmed,
     untracked guesses on the highest-value inputs. -->

## Feature
<!-- What feature are you adding? One sentence. -->

## Problem / Why
<!-- What problem does this feature solve? What user need is unmet by the current product? -->

## Target Users
<!-- Which existing users need this? Or does it unlock new user types? -->

## New Behavior
<!-- The system must... (each line = one new required behavior) -->

## Success Criteria
<!-- How will you know this feature is done? Given/When/Then format preferred. -->

## Touch Points
<!-- A feature is a change to an existing system. Which existing parts does it
     MODIFY vs purely ADD to? List the existing FRs / screens / modules / files
     this feature touches. (If it's purely additive and touches nothing existing,
     write "none — purely additive".) -->

## Must Not Break (Regression Boundary)
<!-- The existing behaviors that MUST remain unchanged after this feature ships —
     the one thing a feature has that a greenfield project does not. Each line =
     an existing behavior to protect, in testable terms.
     e.g. "Existing login flow (FR-001) keeps returning 401 on a bad token."
     Phase 1 turns each of these into a regression NFR (priority MUST) so Phase 3
     generates a test that fails if the feature breaks it. If truly nothing can
     break, write "none — isolated" and say why. -->

## Out of Scope
<!-- What this feature explicitly does NOT build (deferrable scope — different from
     "Must Not Break", which is about not breaking what already works). -->
