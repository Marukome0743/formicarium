<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-13T19:34:08Z [unit u3-install] — C02/C03/C04/C11の承認済み選択を再質問せず、catalog snapshot、共通予約と原子的登録、全entry検査、取消後cleanupを仕様化した。U3の正式36試行はU1と同じ入力identityで行い、U4後B1と区別する。
- 2026-10-12T23:12:06Z [unit u2-session-guest-api] — 承認済みC02/C03/C06/C11から判断できる境界は再質問せず仕様化した。raw JSONの重複keyはobject化する取得境界が拒否し、純粋同期APIは失われた情報を復元したと主張しない。U2暫定候補とU4統合後B1証拠を分離する。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
