# U3 install 実装計画

## Summary
- Builds: 実配信入力を復元し、必須試験のskipを拒否するU3 CI・受入入口の修正。
- Touches: scripts/migration-installのCI入力・実行・完了確認、専用workflow、acceptance試験、固定CI入力と実装記録。
- Tests: 入力欠落・改変・不正パス・容量超過とexit0のskipを拒否し、実配信8試験skip0、新候補の回帰・coverage80%以上・正式36試行・署名付き同一候補CIを確認する。

## 前提と境界
承認済みC02/C03/C04/C11、U3 functional-design、nfr-requirements、nfr-design、infrastructure-designを実装根拠とする。直接要件FR1/FR4/FR5/FR6とBR3.1–3.10に追跡する。User Storiesは生成されていない。
U2完了済み証拠は保持し、U3の成功証拠として流用しない。AI-DLC本体と品質基準は変更しない。U4のコマンド構文、U5以降のビルド・配布は対象外。DB、永続repository、独立UIは存在しないため該当層は省略する。
全ビルド・試験はmain sessionで逐次実行する。通常は各層の実装後にテストを書いて実行する。失敗時は観測結果と修正案を示して確認を待つ。

## Steps
Steps 1–7は既存実装の履歴として保持する。本再開での修正はStep 8のCI入力・skip拒否と、Steps 9–11の現在候補に対する受入れに限定する。共有SHA256・公開API・製品の容量や時間の基準は変更しない。
- [ ] Step 1: 構成とrunner確認。既存tsconfig.json/tsconfig.tests.jsonとBunビルド、node:test、Playwrightを調査し、tests/migration-install/runner-ready.test.tsを作成する。ビルド後、専用runner-ready.test.jsを最初に実行して、Node24・ESM・独立consumer入力・テスト探索範囲を確認する。新規テストを走らせる前に実行可能性を観測し記録する。mise.tomlに専用タスクを宣言する。
- [ ] Step 2: カタログ層をruntime/install-catalog.tsへ実装後、tests/migration-install/catalog.test.tsを作成・実行する。全字段・canonical metadata・深いsnapshot・既定/厳密選択・長さ/サイズ・URLを検証する。Nodeではoriginのない相対URLをINVALID_INPUTとしてfetch前に拒否し、ブラウザではdocument originだけを使う。BR3.1/3.2、D1。
- [ ] Step 3: runtime/install-transfer.tsを実装後、tests/migration-install/transfer.test.tsを作成・実行する。HTTPS/credential omit、Node全redirect検査最大5、ブラウザredirect:error、128MiB実受信上限、宣言値整合、120秒deadline、download SHAを検証する。未知長progress total=null、ネットワーク失敗にretry/fallbackを付けない。BR3.4/3.6、D2。
- [ ] Step 4: runtime/install-archive.tsを実装後、tests/migration-install/archive.test.tsを作成・実行する。DecompressionStream gzipと独立tar scannerを採用し、Node/3ブラウザの実在機能を確認する。512byte header/checksum/numeric/padding/end/trailing、全entry検査、256MiB展開総量、4096entry、4096byte path、1MiB metadataを維持する。USTARと実アセットが必要とするGNU/PAXを限定対応し、未知形式/sparse/deviceを拒否する。duplicate/traversal/link graph cycle/欠落/root逸脱/選択非regularを拒否する。ホストFSへ展開しない。BR3.5、D3。機能不足が判明したら設計変更を黙って行わず確認する。
- [ ] Step 5: runtime/install-lifecycle.tsとruntime/install.tsを実装後、tests/migration-install/lifecycle.test.tsとpublic.test.tsを作成・実行する。既存runtime/session-port.tsのacquire/install reservation・epoch・signal・commitGuest/releaseとC03 validateGuestを使い、public registerへの再入を避ける。install180秒deadline、chunk yield、同期validation前後チェック、最初のterminal理由、finally cleanup、旧guest保持とatomic commitを検証する。progress callback例外/reentry/terminal後通知も検証する。既存portに変更が必要なら最小変更をruntime/session-port.tsと対応U2テストに限定し、二重所有を作らない。BR3.3/3.6–3.9、D4/D5。
- [ ] Step 6: runtime/public.tsとtypes/index.d.tsへC04 createInstaller・Catalog・Progress・InstallResultを公開する。公開entry点は増やさずinternal portは非公開。実装後にtests/migration-install/types-valid.ts、types-invalid.ts、consumer.test.ts、consumer.spec.ts、playwright.config.tsを作成する。偽造session、mutation、BUSY、cancel/reset/dispose、失敗再install、成功置換を独立tarballのNode/Chromium/Firefox/WebKitで確認する。BR3.1/3.3/3.7/3.8、FR4/FR5/FR6。
- [ ] Step 7: 追加の性能改善。performance-recovery-proposal.mdの36試行未達（Biome/Firefox中央値3435.58ms、validate中央値2636.46ms）に対応し、runtime/guest-validation.tsのguestSha256に限定して、64byte blockごとの状態8要素のdestructuringと配列・entries iteratorによる更新を、8個の直接読み出し・直接更新へ置き換える。64round、全block、padding/endianness、全ELF hash、所有copy、metadata/buildKey照合、同期C03とprivate brandを維持する。U2共有ソースと生成JSをU3の個別source claimへ含め、共有C03回帰と独立レビューを行う。実装後にtests/migration-install/hash-regression.test.tsとhash-regression.spec.tsを作成し、独立Node crypto/WebCryptoで既知vector、空入力、55/56/63/64/65byte境界、複数block、binary、offset付きUint8Arrayを照合する。既存C03異常入力/偽造handle拒否・copy保護とNode/3browser consumerも再検証する。tests/migration-install/browser-modules.d.tsに必要なSHA試験用型宣言を追加し、playwright.config.ts、mise.toml、runner-ready.test.ts、scripts/migration-install/ci.ts/completion.tsとそのacceptance.test.tsの個別パスを新しい8件の単体・2本のブラウザspecへ整合する。runtime共有最適化以外のアルゴリズム変更やhash省略は加えない。効果不足は確認する。
- [ ] Step 8: 配布と検証入口を実装する。package.json、scripts/package/stage-package.ts、scripts/package/coverage-inventory.jsonを新規runtime5件と生成JSに整合する。scripts/migration-install/stage.ts、completion.ts、coverage.ts、measure.ts、ci.ts、ci-inputs.tsと生成JS、ci/migration-install/inputs.bundle.json、.github/workflows/migration-install-u3.ymlを専用入口として作る。既存U2入口の証拠形式・同一入力復元を利用するが、U3専用inventory/identity/全工程一覧を再生成する。重複実装を避けるため共通化が必要ならscripts/migration-session/stage.ts、completion.ts、coverage.ts、ci.ts、ci-inputs.tsの内部関数抽出に限定しU2互換を回帰検証する。mise.tomlのmigration-install-unit/browser/stage/completion/measureタスクは個別パスを指定する。型invalid fixtureをtsconfig.tests.jsonの通常buildから除外し、専用型検証で明示実行する。
- [ ] Step 9: 正式受入れを逐次実行する。新しい全第一者JS固定一覧を分母に、未収集ファイルも残し、Node/Worker/別process/browser全realmの生coverageを収集して行coverage80%以上を検証する。既存probe8項目・native一致・wasm1GB・waitAsync削除を維持する。probe600秒/aube840秒、1worker、retry0。36試行は既存固定assetと同一origin HTTPSミラーで、非ダウンロード中央値3秒以下を確認し、download SHA処理時間を非download側へ計上する。計測に重い処理を並行しない。localhost証明書登録/削除が必要なら指紋と実コマンドを提示して承認を受け、finallyで削除する。
- [ ] Step 10: U3専用候補をローカルに準備し、固定core SHA・全source inventory・tarball SHAを一致させる。署名付きjj pushと1回のCI試行は具体的コマンド提示後の個別承認を待つ。CIは実Bun絶対パス/版を確認しBUN_EXECUTABLEを設定、固定coreをローカルobject入力から復元する。GitHub署名Verified、head/run attempt、生artifact ZIP・全realm・coverage・同一候補を検証する。既存U2成功runは代用しない。
- [ ] Step 11: README.md、docs/install-api.md、code-summary.md、traceability.jsonを作成し、生成JSを内容変更せずjj追跡する。レビューsource-manifestは個別実ファイルを列挙し、未意図の.js.mapを混入させない。独立最終レビューを行う。全工程が成功した新規U3結果の生ログとsource/CIを固定する短い完了確認コマンドを作成・改変拒否も検証し、実コマンドを提示して承認を待つ。承認後の正式確認成功で通常完了へ進む。

## 今回のCI入力・受入入口修正

1. 不具合の失敗観測を残す。既存のU2_ACTUAL_SITE未設定時の実観測（実配信8試験中6pass・2skip、exit0）を保持し、tests/migration-install/acceptance.test.tsへ、必須入力欠落とexit0でもskipを含む結果を受入れが拒否すべきことを示す失敗試験を追加する。ビルド後の現行入口で失敗をmainが観測してから修正する。
2. scripts/migration-install/ci-inputs.tsの実配信サイト入力を、圧縮する10ファイルと既存CI入力からcopyする1ファイルに分ける。固定11ファイルの相対path・byte数・SHA256は維持する。既存CI manifest内の `dist/guests/aube`（36948544bytes、SHA256=c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e）だけを固定参照し、サイトの `dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest` へcopyする。同じbyteを持つ別pathへのfallbackや任意source指定は導入しない。残り10ファイルを新しい `.artifacts/migration-install/actual-site-v2.tar.gz` へwxで作成し、既存の全11ファイルarchiveは保持する。新archive1件だけを既存manifestの通常files集計へ加え、元の全logical行と217941020bytesの集計を保持する。payloadの重複排除や参照を理由に既存logical行を減算しない。

   全11ファイルarchiveの実測59173768bytesを追加すると277114788bytesとなり、256MiB上限268435456bytesを8679332bytes超過したため採用しない。mainのread-only・メモリ内USTAR/gzip level9計測では、上記1guestを除く10ファイルarchiveは36727106bytes、合計254668126bytes、余裕13767330bytesだった。これは計画案のサイズ検証だけで、新archiveの作成・復元・受入成功は未検証。実装後の実ファイルを再計測し、合計超過なら停止する。

   参照元はmanifestの固定path/bytes/SHAと実blob、復元後sourceのregular file/全byte/SHAを確認してから使用する。10ファイルarchiveは欠落・未知path・重複・不正header/padding/end・symlink・改変を拒否し、参照先guestがarchive内へ再混入した場合も拒否する。参照元を先に復元・検証した後、bounded copyで新規サイトを構成する。最後にarchive由来10件と参照由来1件の全11ファイルのbyte数/SHAと余分なfile/directoryなしを確認する。圧縮入力と復元後サイトの双方に合計256MiB・個別128MiB・metadata1MiB・4096entryを適用し、定数と集計規則を緩めない。製品runtime、共有SHA、U1/U2の封印証拠は変更しない。
3. scripts/migration-install/ci.tsと.github/workflows/migration-install-u3.ymlで、必須試験の開始前にサイトを復元し、U2_ACTUAL_SITEを復元先へ固定する。独立した後続processにも同じ検証済みパスを引き継ぐ。欠落時は試験を成功扱いせず開始前に拒否する。通常の軽量CIや本体公開APIへ新しい必須入力を広げない。
4. scripts/migration-install/completion.tsとci.tsのU3受入境界で、実行した必須テストの生ログを検査する。exit0に加え、正の実試験数、fail/cancel/skip/TODOなしを要求し、TAP・Node spec・Playwrightの実際のsummary形式を扱う。保存済みCIログを再検証する側にも同じ条件を適用し、skipを含むログからchecksCompletedや合格証拠を作らせない。build等の非テストcommandへ試験summaryを要求しない。U1/U2専用current-completionの成功をU3の完了へ流用しない。
5. 既存acceptance28ケースを維持し、固定参照の正常copy、参照元欠落・wrong source path・同サイズSHA改変・symlink、archiveへの参照guest再混入、10件の欠落/extra、fallback禁止、materialized11件の総量/個別/metadata/entry上限/+1を追加する。不具合の再現テストの失敗をmainで観測してから参照方式を実装し、同じ試験で成功を確認する。既存TAP/Node spec/Playwrightの正summary・skip/fail/空結果拒否も維持する。mainでbuild、typecheck、単位内acceptanceを逐次実行した後、新圧縮ファイルを作成・inspectして実合計を確認する。全ソース/生成JSを確定してから旧ci/migration-installを新規UUID付き.artifactsへrename保存し、canonical入力をprepare/inspect/restoreする。旧bundle/payload・全11件archive・v5/旧reportを上書きしない。CIと同じ復元環境でtests/guest-distribution/integration.test.jsの8件が全実行され、8pass・skip0となることを先に確認する。個別source-manifestと新固定CI入力を整合させる。
6. 修正後のsource/pack/consumerを新しく固定し、Steps 9–11へ戻る。旧v5の21工程と旧候補の正式36試行は履歴として保持する。正式36試行後は証明書削除・未登録を確認し、署名付きpushと1回のCIの実コマンドは別途承認を待つ。新U3結果を証明する短い完了確認コマンドも提示して承認を待つ。

## テスト設計と追跡
CatalogResolver、AssetTransfer、ArchiveInspector、OperationLifetime、ProgressReporterは各5–8以上の意味のあるケース。SessionPort/validateGuest境界と独立consumerを統合テストで確認する。定数を読み返すだけのテストではなく、境界直前/超過、正しいarchiveと不正archive、race時の状態・旧guest・後始末を観測する。
FR4→Steps2–7、FR5→Steps5–7、FR1→Steps7/9–11、FR6→Steps6–11。BR3.10→Steps8–11。NFR1–4/6–8の12詳細IDは各D1–D6実装と受入れへ逆方向も追跡する。
追加Step7は公開C03契約を変えずに実装の割当て量を減らす計画変更である。元のStep5のU2変更限定には、この承認対象のguest-validation.ts/生成JS変更を明示的に追加する。未達結果は正式受入れへ置換せず、新source inventory・候補・独立consumerと実36試行で再判定する。
実機Safariは未検証と明記する。WebKitで代替して実機合格としない。新規コア不具合はnative Linux再現を先に行う。新規費用/公開/本番適用はこの計画の承認に含めない。

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


