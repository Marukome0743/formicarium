# U2 実装計画

## Summary

- Builds: 既存U2実装と現在の検証証拠を照合し、完了確認を復旧する。
- Touches: U2の実装記録・追跡表・個別パス一覧・試験指示。今回の再開ではアプリケーションコードを変更しない。
- Tests: v5の全21工程exit0、U2/U3計測付きNode115件・U2の3ブラウザ9件、配布21JSのcoverage91.65%を照合し、承認済みの短時間完了確認を実行する。

## 対象と前提
FR2/FR5/FR6、BR2.1–BR2.11、U2 NFR2.1/2.2/3.1–3.5/4.1/4.2/6.1/8.1/8.2を実装する。User Storiesは省略されており、直接FR/BR/NFRで追跡する。
U1の実36試行と固定Biome CIの通過証拠を事前条件として保持する。U1の承認済みsource/evidenceを編集しない。U3取得・install、U4コマンドと最終B1、実公開はこの単位の実装対象外。
調査時private0.1.0-rc.1の作業sourceを公開基準とみなさず、公開0.2.1との差分を確認する。U2候補はstaging内0.3.0として暫定証拠に明示し、rootの公開状態やタグを変更しない。

## 順序と変更対象
Step 1–8は既存実装の履歴であり、再開による再実装を指示しない。今回実施する範囲はStep 9–11。
- [ ] Step 1: 既存runner・型・build設定を確認する。mise run build/typecheck、既存tests/package/runner-ready.test.jsをmainで実行する。U2専用tests/migration-session/とPlaywright設定、miseのmigration-session-unit/browser taskを整備する。DB/repository/UI層は本単位に存在しない。
- [ ] Step 2: GuestValidation層をruntime/guest-validation.tsへ実装する。共通同期SHA256・canonical metadata・static ELF64検証、C11上限、private WeakMap handleとfixture全件検証/copyを実装する。既存純粋処理が適合すれば再利用し、Node専用importやU1開発コードを配布runtimeへ依存させない。（FR2、BR2.1/2.2/2.3/2.9、NFR3.1–3.5）
- [ ] Step 3: Step 2実装後、tests/migration-session/guest-validation.test.ts・fixture.test.tsを作成しmainで実行する。digest vector/metadata未知field、ELF不正/overflow、上限/+1、後続mutation、偽/別instance handle、symlink loop/escape、hardlink整合を含む。（FR2、安全性要件）
- [ ] Step 4: runtime/lifecycle.ts・state.tsにsession所有予約token/epochとguest registryを統合し、必要ならruntime/session-port.tsに非公開C02 portを置く。run/readFile/remove/listEntries/setCwdも同一予約、内部継続は再acquireなし。reset/disposeの取消・cleanup・初期状態復帰/終端、atomic commit・旧release拒否を実装する。既存Worker cleanupの有限待機とraw run意味を維持する。（FR5、BR2.4–2.8、NFR4.1/4.2）
- [ ] Step 5: Step 4実装後、tests/migration-session/reservation.test.tsを作成しmainで実行する。制御可能なspawn/cleanupでbusy、取消、旧commit/release、reset/reset・reset/dispose、失敗時FS/cwd/登録不変、2session分離を再現する。（FR5）
- [ ] Step 6: runtime/public.tsとtypes/index.d.tsへC03の4関数とGuestHandle/GuestBuildInfo/期待値型を追加し、Node/browser Sessionへ接続する。package.json files、scripts/package/stage-package.ts・coverage-inventory.jsonに新配布JSを登録する。C02はpackage exportへ公開しない。（FR2/FR6、BR2.10/2.11）
- [ ] Step 7: Step 6実装後、tests/migration-session/public.test.ts・consumer.test.ts・types-valid.ts/types-invalid.ts・consumer.spec.tsを作成し実行する。既存実guest/wasmを使い同一packをNodeと3ブラウザから利用し、検証後copy・fixture・session競合とexports/typesを確認する。実機Safari未検証を保持する。（FR2/FR5/FR6、NFR6.1/8.1）
- [ ] Step 8: scripts/migration-session/stage.ts・completion.tsと専用taskを作成する。新source/pack/inventoryへbindしたU2暫定候補、全realm coverage、既存consumer/probe/aube回帰を逐次実行し、欠落/skip/未検証は成功にしない。既存package coverage収集処理を拡張する必要がある場合はU2配布変更と対応づけ、80%/timeout/worker/retryを維持する。U1の固定14ファイル証拠をU2候補の証拠として使わない。統合前CI成功は別途実観測し、未承認push/外部適用を行わない。（NFR2/8）
- [x] Step 9: 既存C02/C03実装と契約、v5固定入力・結果・source/pack/inventory・consumer・配信元の結合を照合する。2026-10-15T11:06:12.240Z–12:11:43.979Zにmainで観測した21工程の原ログを用い、今回の再開で新たに試験を実行したとは記載しない。共有SHA256の承認済みU3変更は既存の検証対象として確認し、本計画で再実装しない。（FR2/FR5/FR6、NFR8）
- [x] Step 10: U2のcode-summary.md・traceability.json・source-manifest.jsonとcurrent-recovery-verification.mdを現在の証拠へ整合させる。個別パスの主張を保持し、旧16JS/26pack・署名付きCIおよび旧v4の履歴と、現在21JS/31packのv5ローカル証拠を区別する。封印された過去の入力・結果・証拠、U1承認済み成果物は変更しない。（NFR8）
- [ ] Step 11: 独立レビューを受け、指摘を検証する。主担当が承認済みverification-command.txtのコマンドでU2の正式完了確認を実行し、成功時は通常の単位完了承認を自動で進める。新しい実装・検証入力・コマンドが必要なら先に確認する。（NFR2/8）

## 検証と停止条件
各層のtest-after順序、main sessionでの逐次実行、既存品質基準を維持する。今回の変更は記録の整合であり、新規の実装追従テストは追加しない。
現在の証拠はcurrent-recovery-input-20261015-v5.json（SHA256 54b5da8fa4052a6894eab0cc63ee02556252b253d17f6ab8404f1aa5f5afc3bd）とcurrent-completion-055093d2-bbde-4851-8566-663a68c1e8bd/current-local-verification-report.json（SHA256 12d6bd4a509ebf374f052067959595d86f5e8c4c24035ef9bea4597e24275ff2）に固定する。全21工程exit0、coverage1768/1929行（91.65%）、skip0を既存の原ログから照合する。短時間verifyで現在sourceと封印済み証拠の一致を再確認する。既に承認・設定済みのverification-command.txt（command SHA256 5a7148debea2915ee964a4e97e61f2fa2d279285c6a2a5b37dbf5e89f9312c24）を変更せず使用し、旧migration-session-completionの16JS入口を現在21JSの完了根拠へ転用しない。
証拠不一致、検証失敗、機能上の欠陥、封印対象の変更が必要になった場合は停止して具体的な修正・再検証を確認する。21工程の自動再実行、push、CI試行は本再開計画に含めない。実装計画・試験指示を変えた場合はstrictの再承認を受ける。
U3 installと共有SHA256性能改善は実装済みであり、U3の正式受入れは未完了。文書更新前候補の36試行成功は履歴として保持し、現在の候補への付替えはしない。U3のCI実配信入力修正・再検証は承認済みの後続作業とし、U2再開の記録整合へ混ぜない。現在のローカル証拠だけで統合前CI、U3受入れ、U4の完全C06チェック、U5開始、公開を許可しない。実機Safariは未検証。

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
