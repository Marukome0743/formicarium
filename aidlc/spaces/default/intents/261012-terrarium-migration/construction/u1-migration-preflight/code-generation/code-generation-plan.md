# 初期試行の実装計画

## Summary

- Builds: 実装済みU1の完了確認を復旧し、U3 installの追加改善へ進めるための現在の検証入口を整える。
- Touches: scripts/migration-preflight/、tests/migration-preflight/、mise.toml、integration/vivarium/preflight/、docs/results/。
- Tests: U1単体55件、完了確認の改変拒否35件、既存Node/ブラウザ回帰、現在の配布一覧を分母とするcoverage80%以上。過去の36試行とCI再利用の固定証拠も照合する。

## Sources and Boundaries

FR1/FR9、U1、C01/C11、U1 NFR要件/DS1–6/基盤設計。user storiesは省略済みなのでFR/NFRを各stepへ直接対応付ける。Steps1–8の実装と過去の実測は保存済みで、再実装しない。現在の変更済みsourceに対する完了確認は未検証。U1 packagingは機能設計の対象外で、C01を機能境界に使う。共通install/command/public guest APIと汎用builderは後続単位。SHA256の性能改善はU3の計画に保持し、このU1復旧で先行実装しない。

観測済み: mise lsにproject-pinned Node24.21.0/Bun1.4.2、既存tsconfigがscripts/testsを含む。既存runtime/web/api.ts、integration/terrarium/guest-distribution/resolver.tsのELF検査、scripts/package/coverage.tsが存在。vivarium AGENTS/mise/workflow一覧を読んだがmusl固定guest専用workflowは存在しない。runner容量・権限・baseline remote存在・資産の実URL/版・CORS・速度は未検証。これらは作業内で観測し、失敗時は確認する。

## Implementation Steps

- [ ] Step 1: main sessionでjj状態/変更前revision、既存generated資産・依存・API consumer baselineを記録。mise run build / typecheck / test-light / test-consumer と必要な既存probe/aube回帰を順次確認。失敗・入力欠損では変更前に停止し既存失敗を提示する。未変更aube再buildなし。（NFR2/NFR8）
- [ ] Step 2: scripts/migration-preflight/とtests/migration-preflight/のrunner/configを整備。mise.tomlにmigration-preflight-unit、migration-preflight-browser、migration-preflight-verify taskを追加。tests/migration-preflight/playwright.config.tsは3browser/worker1/retry0、isolated server。scriptsのgenerated JSは既存build/emit方式を確認して適合させる。新taskは実装後に実体を確認し、既存taskを呼べることだけでU1合格にしない。（FR1/NFR6）
- [ ] Step 3: scripts/migration-preflight/evidence.tsにC01型・36行一意性・有限非負時間・各組合せ中央値/初回/最大/fetch・baseline identity/reuse照合と全条件AND判定を実装。その後tests/migration-preflight/evidence.test.tsに正常、欠落、重複、CORS/exit失敗、3000境界/超過、時間不正、cache identity不一致の5–8件以上を作成・実行。（FR1/FR9/NFR1.1/NFR5.1/NFR7.1）
- [ ] Step 4: scripts/migration-preflight/assets.tsに公式資産を固定版/URL/digest/source metadata入力から有限取得・全entry安全検査・展開・ELF検証copyへ導く試行用経路を実装。既存検証を再利用し、新公開APIを先行変更しない。全hopを検査できないbrowser取得はredirect:error等で検査不能を失敗とし、ミラー案確認まで停止。tests/migration-preflight/assets.test.tsでdigest/ELF/metadata、path/link/duplicate/truncated、容量境界、HTTP/redirect/timeout/abortのfixtureを実装後に実行。（NFR3.1/NFR3.2/NFR4.1/NFR4.2）
- [ ] Step 5: scripts/migration-preflight/runner.tsとtests/migration-preflight/serve.tsで既存公開browser API/Worker資産をsame-origin/COI/CSP下で起動。計測と非計測の検査を分け、各trialは新session、cache条件を明示。実行対象は同一固定版guest、trial0と1–5、6組合せ36行。出力はtextとbyte digest。tests/migration-preflight/runner.test.ts（5–8件、epoch/取消/cleanup/計測欠落/入力copy）とconsumer.spec.ts（3browser×2tool×6trial）を実装後に逐次実行。性能trialはcoverage instrumentationなし、coverageは別経路で既存固定分母を維持。（FR1/NFR1.2/NFR2.1/NFR6.1/NFR7.1）
- [ ] Step 6: integration/vivarium/preflight/build-baseline.sh と baseline-workflow.yml に最小Biome musl CI試行案を作成。FR9完全commit事前照合、tool/repo/commit/builder hash/全依存入力によるcanonical key、ELF/build-info検証、staging/単一writer/atomic受入、同key第2回compile省略、4h deadline/子process group取消を備える。Actionの最新versionを公式情報で確認し全SHA/commentを固定、toolchain/image入力を明示。tests/migration-preflight/baseline.test.tsでkey変化/改変/欠損/同key再利用/途中終了を実装後に検証。これはvivariumへ移すレビュー可能な案で、local模擬試験をremote CI実績と呼ばない。（FR9/NFR4.1/NFR5.1/NFR8.1）
- [ ] Step 7: scripts/migration-preflight/verify.tsへ実C01/環境・入力inventory/CI run URL・build evidence/必要試験・coverage照合を組み込み、欠落では非zero終了。migration-preflight-verifyが実装済みUnitだけを対象に、必須unit/integration/E2E/coverageと実成果を検査する入口となる。現時点のtask名は設計上の予定で共通検証コマンドの承認ではない。（全NFR）
- [ ] Step 8: docs/results/terrarium-migration-preflight.md とJSON evidenceの出力先を整備、実URL/版/digest/環境/負荷/cache/36行/初回中央値最大/fetch/remote build再利用を記録。実際のvivariumへの変更・push・workflow起動・Release保存が必要な段階では具体差分/対象commit/job/保存先/費用/切戻しを示し個別承認を待つ。その操作とremote実測証拠が未完ならU1未完のまま停止。（FR1/FR9/NFR8）
- [ ] Step 9: 本体既存回帰とfirst-party固定分母line coverage≥80%をmain sessionで逐次検証。probe600s/8項目、aube840s、worker1/retry0、native完全一致、wasm1GB、waitAsync削除維持。入口整備後、初回の単位完了確認前に実コマンド・必須試験/coverage対応と未実行範囲を提示して承認後に確定。code-summary/traceability/source-manifestには生成物も含め全変更と実結果を記録し、完成したコードの独立レビュー後にU1受入。（全NFR）
- [ ] Step 10: 完了確認の復旧。修正済みverify-completed-result.mjsの固定U2一覧・277 source snapshot・135 evidence seal・14工程・1370 realms・coverage80%・同一CI/head/署名/pack照合を維持する。retained-evidenceの成功は過去のU2だけを確認し、currentSourceVerified=falseの結果で現在のUnitを承認しない。現在のU1/U2を検査する入口を整備し、新規候補のsource/pack/独立consumerを固定して、U1試験、既存U2/APIのNode・Worker・3ブラウザ回帰、現在の全配布JSを分母とするcoverageを逐次実行する。新しいinstall JSを未収集として分母から除かず、必要なinstall回帰も収集する。U3の性能受入とCIはU3の未完項目として残し、今回の成功でU3完了としない。改変・欠落・非zero・古い候補の拒否を試験し、新しい実コマンドと検査範囲を人間に提示・承認後に設定する。新しい結果のsource/pack/全工程記録が揃うまで、過去の成功資料で現在のコードを合格にしない。（FR1/FR9/NFR2/NFR8）

## Test Ordering and Scope

runner準備→各層実装→同層試験のtest-after。既存不具合は再現失敗→修正→同試験成功。DB/新HTTP API/製品端末UIは対象外。C01用fixtureの成功と実guest試行の成功を区別。Standardの各部品5–8件以上、境界統合と要件による性能/E2E、安全性試験を追加。Testing Contractのscope_floor欄が追加floorなしでも、上流NFR2のcoverage80%と既存品質条件は必須。

## Impact and Rollback

runtime公開API/core、旧terrarium/vivarium recipe/verdict、showcase、infra stateはここで変更しない。新規試行scripts/tests/taskとCI試行案に限定。既存emit設定に不足があれば最小変更しmanifestへ記録。各PR変更前revisionとinventoryを保存しjjで当該変更だけ戻す。生成stagingだけを破棄して既存受入資産・他者変更を保持。外部操作は計画承認と別の具体承認を待つ。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。\n- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。\n- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。\n- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。\n- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:c174dde61b23d97d1733ad98b91568ee85c7de913db166d498965b6845a4c286",
  "contract_sha256": "sha256:10b6f50c2e853225a46984ab35ccfb615ca938fd59f89dd0c81174ba91834d14"
}
```

