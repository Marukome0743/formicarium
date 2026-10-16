<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-16T20:40:47Z [unit u4-command] — U3で受入済みの専用CI経路の構成（固定入力、全realm coverageとrunner台帳、job専用CAのFirefox profile、独立ZIP照合、短い完了確認コマンド）を基に、U4とB1統合受入（C06の必須check集合）を設計した。U3の証拠や完了確認コマンドは流用しない。workflow名・branch名・CI入力の具体値は、Code Generationの計画で承認を受ける。
- 2026-10-13T19:45:45Z [unit u3-install] — 既存U2 CIは専用16JS分母なのでU3の成功へ再ラベルしない。新source/pack/coverage/正式36試行を準備し、localhost証明書登録とpush/CIは具体コマンドの承認後だけ実施する。
2026-10-12T23:23:13Z — [unit u2-session-guest-api] 新規cloud基盤なし。既存CI/pack/realm coverage経路へのAPI試験追加だけを設計し、具体コマンド・push対象は実装計画へ委譲した。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-10-16T20:43:48Z [unit u4-command] — レビューREADY（Minor 3件）。凍結のまま、U4 Code Generation計画へ反映する：(1) Pipeline 7のB1証拠に、C06の名前付きfield（preflightEvidenceId・logSha256）を含める。Node/3browserの各行を、ローカル実行とCI実行のどちらから取るかを明記する。(2) CI artifactの保持期間（1日）が、人間の承認待ち（Pipeline 10→11）の間に切れないようにする。保持期間を延ばすか、run完了の直後に取得する手順を計画に入れる。(3) traceabilityのNFR2.1・NFR8.2を、節単位ではなく具体的なcheckへ対応付ける。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
