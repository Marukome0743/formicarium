<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-13T19:38:06Z [unit u3-install] — library種別でも性能・信頼性・通知の条件をsecurity-requirementsへ保持した。Nodeのoriginなし相対URLは暗黙補完せず拒否し、公開shape変更なしで環境差を明示する。
2026-10-12T23:18:28Z — [unit u2-session-guest-api] libraryの適用文書にNFR2/3/4/6/8を集約。同期検証と非同期取得境界、U2暫定証拠とU4完全B1証拠を区別し、新しいSLOや認証サービスを導入しない。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
