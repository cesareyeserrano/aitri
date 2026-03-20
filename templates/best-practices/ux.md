## UX/UI Standards

Apply these standards to every screen, flow, and component defined in this phase:

- **Mobile-first** — design for 375px first, then scale up. A layout that works at 375px always works at 1440px. Every interaction must be reachable with a thumb. Desktop-first designs routinely break on mobile.
- **Accessibility (WCAG 2.1 AA minimum)** — color contrast ≥4.5:1 for body text, ≥3:1 for large text and UI components. All interactive elements must be keyboard-navigable and have accessible labels. This is a legal requirement in many jurisdictions, not an optional enhancement.
- **Every state must be designed** — for every component: default, loading, error, empty, disabled. An undesigned state is a state the developer will invent — usually poorly.
- **Error states are UX, not afterthoughts** — every error message must tell the user: what happened, why it happened, and what they can do next. "Something went wrong" is not an error message.
- **Feedback within 100ms** — any action that takes more than 100ms must show immediate feedback (spinner, progress, optimistic update). At 1s users lose their sense of flow. At 10s they assume the app is broken.
- **Progressive disclosure** — show only what the user needs for their current task. Complexity must be revealed on demand, not presented upfront. A screen that requires a manual is a failed screen.
- **Form UX** — inline validation (not submit-and-fail). Labels above the field, not placeholder-only. Error messages next to the field that caused them, not at the top of the form. Destructive actions require explicit confirmation.
- **Consistency before creativity** — use established patterns (nav drawer, tab bar, card list, modal) unless there is a strong reason to deviate. Familiar patterns reduce cognitive load and learnability cost.
- **Empty states are features** — a screen with no data must guide the user toward the first meaningful action, not show a blank page. The empty state is often the first experience a new user has.
- **Design tokens are implementation contracts** — colors, typography, and spacing defined in this spec are the contract for Phase 4. Deviation in implementation breaks visual consistency and must be treated as a defect.
