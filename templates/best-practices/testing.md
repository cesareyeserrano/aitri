## Testing Standards

Apply these standards to every test case produced in this phase:

- **Concrete values only** — Given/When/Then must use actual values: email addresses, status codes, field names, data structures. "a valid user" or "some input" is not a test case — it is a placeholder.
- **One behavior per test case** — each TC must test exactly one observable outcome. A TC that checks login AND session expiry in the same test will mask failures.
- **Negative tests assert the exact error** — for every failure path, specify the exact HTTP status code, error message, or exception type. `then: "returns error"` is not a negative test.
- **No trivially-passing tests** — a test that passes regardless of the implementation (e.g., `assert.ok(true)`, or not calling the function under test) is a compliance artifact, not a test. Every TC must be falsifiable: there must exist an incorrect implementation that would cause it to fail.
- **Test isolation** — each TC must be independently runnable. No TC should depend on execution order or state left by another TC. Shared mutable state is a latent flakiness bug.
- **Boundary and edge cases are first-class** — for every input, test: the minimum valid value, the maximum valid value, and one step beyond each boundary. Boundary bugs are the most common class of logic error.
- **Security TCs for every security FR** — if a FR requires authentication, injection prevention, or rate limiting: there must be a TC that proves the control works with a concrete attack input (e.g., `' OR 1=1 --`, `<script>alert(1)</script>`, 101 requests in 60 seconds).
- **Performance TCs for latency/throughput NFRs** — if a NFR specifies response time or request rate, there must be a TC that verifies it under the stated load. "It should be fast" is not a performance test case.
- **Test data is explicit, not assumed** — define the exact state of the system before each TC (the Given). Never assume a clean database or pre-existing records. Tests that rely on implicit state produce intermittent failures in CI.
