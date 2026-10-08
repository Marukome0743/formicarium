<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
2026-10-12T23:21:11Z — [unit u2-session-guest-api] 入力所有権と予約epochの検証位置を具体化。CI最小権限・未信頼PR公開拒否を維持条件として明示し、U2が新しいworkflow/publish権限を持つとは扱わない。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-10-13T19:41:34Z [unit u3-install] — host streamとbounded scannerを設計候補にし、開発用U1 scriptを製品へimportしない。同期guest検証中のabort保証は主張せず、前後のsignal/deadline再確認と実測で安全性を検証する。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
