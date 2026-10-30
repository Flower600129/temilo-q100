# AGENTS.md — Gift Memory rules for coding agents

This repository is for the **Qloo Agentic Hackathon**, deadline 2026-10-31 11:45 Asia/Shanghai.

## Mission

Build a **small, real, non-commerce web gift companion**. Primary user journey: add a person and occasion → see upcoming dates → inspect wishes and personal inventory → optionally use Qloo for evidence-backed cross-domain inspiration → record gift and decrement stock exactly once.

## Working agreement

1. Read the supplied `01_PRD`, `02_TECH`, `03_QLOO_SPIKE`, `04_EXECUTION`, `05_TEST`, `06_SUBMISSION` files before coding.
2. Execute **only the stage explicitly assigned by the user**. Finish with a report and wait for approval before starting the next stage.
3. Reuse existing repo files, inspect current state and run commands before modifying. Do not overwrite unknown work.
4. Implement working features, tests and error states; do not produce fake clickable demos or fabricated Qloo responses.
5. Real keys only in server-side `.env.local` / deployment environment. No secrets in source, screenshots or logs.
6. Respect recipient privacy: do not send names, exact dates, notes, addresses or contact information to third-party APIs. Use only explicit cultural interests as query signals.
7. Core invariants: gift inventory quantity never negative; repeat gift submission deducts once; cancellation restores once; upcoming birthdays correct across years and leap years.
8. Never create marketplace, payment, logistics, social feed, global wish count, forced friend accounts or unverified popularity figures.
9. README and judging instructions in English; UI English-first with localization-ready strings, unless user changes direction.
10. When blocked, clearly report the issue, preserve working baseline, and propose the minimum unblock action; do not quietly invent implementation success.

## Quality gate after each stage

Report changed files, commands run, tests performed (including failures), what is truly working, Qloo live status, and open risks. Keep feature expansion in `docs/backlog.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
