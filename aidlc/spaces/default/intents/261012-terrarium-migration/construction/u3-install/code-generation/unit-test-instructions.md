# U3 install 単体・統合試験手順

## 実行時点
既存U3部品、共有SHA最適化、独立Node/3browser consumerとSHA回帰は実装・観測済み。v5固定入力による21工程は全exit0、21JSのcoverage91.65%・skip0であるが、その正式確認の対象はU1/U2でありU3受入れへ流用しない。文書更新前候補の正式36試行成功は履歴として保持する。現在のU3候補の正式受入れは未完了。本再開はCI実配信入力の不足と必須試験skip許容の修正を対象とする。失敗再現をmainで観測してから修正・再検証する。runnerの既存確認結果は保持する。

## コマンド
Nodeはmise lsで管理版を確認し、現行実パスを使う。現在の承認対象設計値は /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node。buildは既存declared mise taskを確認して使い、U3 test実行前にJSを生成する。

1. runner: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/runner-ready.test.js`
2. catalog: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/catalog.test.js`
3. transfer: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/transfer.test.js`
4. archive: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/archive.test.js`
5. lifetime/API: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/lifecycle.test.js tests/migration-install/public.test.js`
6. consumer/types: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/consumer.test.js`。このfixtureが専用types-valid/invalidのコンパイル結果も検証する。
7. browser: 更新後 `mise run migration-install-browser`。固定Playwright CLIで`test tests/migration-install/consumer.spec.ts tests/migration-install/hash-regression.spec.ts --config tests/migration-install/playwright.config.ts --workers=1 --retries=0`を実行し、3browser projectを明示する。
8. unit aggregate: 更新後 `mise run migration-install-unit`。既存7個と新hash-regression.test.jsの計8個を個別列挙し、glob/全workspace探索/skipへ置換しない。
9. hash regression: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/hash-regression.test.js`。
10. 同期C03共有回帰: `/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-session/guest-validation.test.js tests/migration-session/public.test.js tests/migration-install/public.test.js`。

## 今回のCI修正を先に検証するコマンド

mainでビルド後、失敗再現・修正後の両方に同じ単位内のコマンドを使う。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

ここへ実配信入力の正常復元と欠落・改変・不正path・symlink・容量上限/+1、およびexit0でもTAP/Node spec/Playwrightのskip/fail/空summaryを拒否する試験を追加する。外部ネットワーク・実guest実行を必要としない小さなfixtureで拒否条件を検証し、実配信確認は次の別コマンドで行う。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/guest-distribution/integration.test.js
```

後者はU3 CIと同じ入力復元後、U2_ACTUAL_SITEを検証済み復元先へ設定して実行する。8pass・fail0・skip0を要求する。site未設定時の既存6pass・2skip・exit0という失敗例は保持し、修正後はU3受入入口がそれを拒否することを確認する。圧縮入力の実byte数を既存CI manifest合計へ加算し256MiB以下を実測する。10件のarchiveと既存CI参照1件から構成した後も固定11ファイルと全byte数/SHAを検査する。圧縮・展開や容量の計数を緩めて通さない。

## 重複guestの固定参照方式：承認後の実装・検証

全11件archiveの実測59173768bytesを既存217941020bytesへ加算すると277114788bytesで、256MiBを8679332bytes超過する。旧archiveを保持し、参照方式用の新archive `.artifacts/migration-install/actual-site-v2.tar.gz` をwx新規作成する。mainのread-onlyメモリ内計測では10件archive36727106bytes、合計254668126bytes、余裕13767330bytes。新実装のend-to-end成功は未検証で、以下は計画承認後にだけ実行する。

固定参照元は `dist/guests/aube`、36948544bytes、SHA256=c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e。固定参照先はサイト内の `dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest`。別pathにも同じSHAがあってもfallbackせず、参照sourceを新しいlogical入力行として重複追加せず、既存行の数・byte合計も減算しない。

既存28ケースに、正常な参照copy、欠落、wrong source path、同サイズ改変、source/ancestor symlink、archiveへの参照guest再混入、10件側のextra/missing、fallback拒否、復元後11件の各上限/+1を追加する。新しい拒否テストはmainで失敗を観測してから実装し、同じコマンドで成功を確認する。意図的skip/TODOの子試験は実ログを検査し、親へstdoutを転送して親summaryを汚染しない。

mainで逐次実行する。実装・生成JSを確定するまでCI入力を作り直さない。

```sh
mise run build
mise run typecheck
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/migration-install/acceptance.test.js
```

acceptance成功後、圧縮だけを先に作成・inspectする。prepare-siteは新version pathへ出力し、inspect-siteは10件のsealと固定参照設計の整合を検査する。source不足を自動取得や別path探索で埋めない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js prepare-site .artifacts/u2-guest-distribution/site-repair-v1
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js inspect-site .artifacts/migration-install/actual-site-v2.tar.gz
```

新archiveの実byte数と既存logical合計217941020bytesの和が268435456bytes以下であることを確認する。超過なら停止し、既存ciは変更しない。上限内で全ソース・生成JSが確定した後だけ、旧canonical CI入力をUUID付き新規保存先へ移し、新規prepare/inspect/restoreする。保存先の既存ファイルを上書きしない。

```sh
mv -n ci/migration-install ".artifacts/migration-install/ci-inputs-before-reference-$(uuidgen)"
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js prepare ci/migration-install
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js inspect ci/migration-install/inputs.bundle.json
/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node scripts/migration-install/ci-inputs.js restore ci/migration-install/inputs.bundle.json
U2_ACTUAL_SITE="$PWD/.artifacts/migration-install/actual-site" /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 tests/guest-distribution/integration.test.js
```

restoreは固定manifest sourceとblob、復元済み `dist/guests/aube` をbytes/SHA・regular fileとして検査してから、10件とcopy1件でサイトを構成する。既存siteがある場合は全11件を再検査し、黙って上書きしない。圧縮入力は既存CI manifestの通常の論理合計へ加え、materialized11件にも256MiB合計・128MiB個別・1MiB metadata・4096entryを適用する。最後の実配信8pass・skip0後も、新source/pack/consumerでcoverage・回帰・36試行・署名付きCI・正式完了確認を別途実施する。push/CIの具体コマンドと新しい短い完了確認コマンドは、従来どおり個別承認を待つ。

## 追加SHAの必須ケース
独立Node crypto/WebCryptoの結果を比較し、空入力、既知vector、55/56/63/64/65byte padding境界、複数block、binary、offset付きviewを5–8以上の意味のあるケースで確認する。既存C03の不正ELF/digest/metadata/偽造handle拒否、コピー保護を維持する。Node/3browserの公開consumerと新候補の実36試行は、純SHA試験とは別に確認する。速さの予測を合格結果として扱わない。

## 必須ケース
catalog5–8+: snapshot mutation、default/exact選択、欠落/重複/未知字段、canonical digest、URL/名前/サイズ境界、偽造session。
transfer5–8+: 正常ELF/archive、unknown length、過大stream、宣言値不一致、SHA不一致、HTTPS/redirect制限、cancel/timeout、cleanup。
archive5–8+: 実asset展開、header/checksum/end不正、総量/count/path境界、duplicate/traversal、root外link/cycle/missing、PAX/GNU規則、選択非regular、cancel。
lifetime5–8+: 競合BUSY、caller cancel、deadline、reset/dispose、旧guest保持、atomic置換、late completion/旧token release、reader/listener/timer cleanup。
progress5–8+: sequence/phase/byte/unknown total、例外非干渉、reentry BUSY、terminal後無し、早期digest計測の非download計上。
consumer: 同一tarballの公開export/型、Node・3browserで正常installと実run、失敗再install/競合/中断/状態保持。全テストのpass/fail/skipと観測内容を記録し、fixture省略を成功へ変えない。

## 結果記録
実行command・開始終了・exit・テスト件数・失敗行・source/pack identityを残す。通常単体成功だけではU3完了としない。coverage/36試行/既存回帰/署名CI/正式短い完了確認は計画Steps9–11の別受入れ工程である。失敗時は再現結果と修正案を提示して確認する。

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


