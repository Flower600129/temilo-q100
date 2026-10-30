# TEMILO · submission text draft

**Status:** text prepared for human review; no Devpost submission or public URLs exist yet.

## Inspiration

Gift preparation often starts with scattered information: a date, a wish mentioned in conversation, what was already given, and gifts put aside at home. TEMILO brings these records together in a small private companion. The problem and value are product hypotheses, not a claim of an undiscovered market or completed user study.

## What it does

Add people without requiring their accounts, record birthdays/occasions and preparation windows, keep wishes and owned gift stock, prepare a plan, then confirm giving. The app deducts stock exactly once and restores it once on undo. Optional Qloo discovery adds real cross-domain cultural leads when known wishes and stock are insufficient.

## How it works

An explicit decision workflow first evaluates recorded wishes, non-zero stock, avoids and gift history. It offers known candidates or asks for missing cultural signals. After user consent, the server resolves real Qloo entities; the user confirms ambiguity and a target category. The app checks up to three template directions against recorded constraints, separates evidence from unknowns, and saves a selected source with the plan. Relevant changes invalidate old results. Users retain the final decision; no LLM execution, personal preference probability or autonomous purchasing is claimed.

Expo SDK 54 / React Native / TypeScript share six validated domain objects. Browser IndexedDB and native SQLite remain local; server routes protect the Qloo credential. Production preparation uses a Node server, strict minimal API payloads, timeouts and a durable single-instance quota ledger.

## What we verified and learned

The finite live matrix used six upstream requests without retries. Radiohead → book and Studio Ghibli → book completed adoption, saved plan, giving, reload and source trace; Jane Austen author → movie was an API-only continuation. Real entity/category disambiguation matters, and some cross-domain results have weak or uncertain relevance. Local wishes/stock remain the reliable baseline; Qloo supplies optional evidence-backed leads rather than verified product facts.

Automated checks cover stock idempotency/concurrency, dates, stale responses, persistence, navigation and production routes. A production Worker bundling defect was found and fixed without clearing old data. See the release-status and security reports for actual limitations and remaining gates.

## Limits and next steps

No payments, shipping, public feed, cloud sync or forced friend accounts. No fabricated SKUs, prices, popularity or recipient-liking scores. Physical-device accessibility, user visual approval, public deployment and external acceptance remain pending. Source is prepared under MIT (Liuyun), active artwork is original or explicitly licensed, and the previous four high dependency entries have verified SDK54-compatible fixes. The non-clean audit still reports 11 low build/configuration entries. The project owner must supply the final demo/repository URLs and confirm eligibility, rights and submission details.
