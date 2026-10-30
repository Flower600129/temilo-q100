# TEMILO · submission text draft

**Status:** ready for human submission review; Devpost has not been submitted.

- Demo: https://temilo-q100.netlify.app
- Source: https://github.com/Flower600129/temilo-q100
- License: MIT, copyright Liuyun.

## Inspiration

Gift preparation often starts with scattered information: a date, a wish mentioned in conversation, what was already given, and gifts put aside at home. TEMILO brings these records together in a small private companion. The problem and value are product hypotheses, not a claim of an undiscovered market or completed user study.

## What it does

Add people without requiring their accounts, record birthdays/occasions and preparation windows, keep wishes and owned gift stock, prepare a plan, then confirm giving. The app deducts stock exactly once and restores it once on undo. Optional Qloo discovery adds real cross-domain cultural leads when known wishes and stock are insufficient.

## How it works

An explicit decision workflow first evaluates recorded wishes, non-zero stock, avoids and gift history. It offers known candidates or asks for missing cultural signals. After user consent, the server resolves real Qloo entities; the user confirms ambiguity and a target category. The app checks up to three template directions against recorded constraints, separates evidence from unknowns, and saves a selected source with the plan. Relevant changes invalidate old results. Users retain the final decision; no LLM execution, personal preference probability or autonomous purchasing is claimed.

Expo SDK 54 / React Native / TypeScript share six validated domain objects. Browser IndexedDB and native SQLite remain local; server routes protect the Qloo credential. The public release uses Netlify Functions with strict minimal API payloads, timeouts and a shared SQL transaction ledger for anonymous Qloo quota. Browser business records remain local.

## What we verified and learned

The local finite live matrix used six upstream requests without retries. A separate public HTTPS Radiohead → book acceptance added exactly two upstream requests without retries and completed adoption, plan saving, giving, reload and source trace. The returned books were music biographies, heavily Beatles-related: useful broad cultural leads, not proof of Radiohead-specific or recipient-specific fit. Radiohead → book and Studio Ghibli → book completed adoption, saved plan, giving, reload and source trace; Jane Austen author → movie was an API-only continuation. Real entity/category disambiguation matters, and some cross-domain results have weak or uncertain relevance. Local wishes/stock remain the reliable baseline; Qloo supplies optional evidence-backed leads rather than verified product facts.

Automated checks cover stock idempotency/concurrency, dates, stale responses, persistence, navigation and production routes. A production Worker bundling defect was found and fixed without clearing old data. See the release-status and security reports for actual limitations and remaining gates.

## Limits and next steps

No payments, shipping, public feed, cloud sync or forced friend accounts. No fabricated SKUs, prices, popularity or recipient-liking scores. Physical-device accessibility and owner visual acceptance remain pending; public deployment and the bounded external functional acceptance passed. Source is prepared under MIT (Liuyun), active artwork is original or explicitly licensed, and the previous four high dependency entries have verified SDK54-compatible fixes. The non-clean audit still reports 11 low build/configuration entries. The project owner must review the supplied Demo/source URLs, confirm eligibility and submission fields, and submit before October 31, 2026 11:45 Asia/Shanghai.
