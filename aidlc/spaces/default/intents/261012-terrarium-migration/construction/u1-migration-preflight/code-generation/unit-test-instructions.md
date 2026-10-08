# 初期試行の試験手順

## Setup

既存Node node:test / Playwright / strict TypeScriptを使う。mise lsでproject pinと実体を確認。宣言taskはmise run、その他はmise実体のNode/Playwrightを解決して実行しshim/mise execを使わない。main sessionで全試験逐次、性能計測時はCI buildも同時に走らせない。新taskはStep2で整備してから使う。

## Unit-Scoped Commands

- `mise run migration-preflight-unit`: 実装済みtask。build済みtests/migration-preflight/のevidence、assets、runner、baseline、prepare-mirror、verify、completionの7単体ファイルをnode --test --test-concurrency=1で実行する。最新のmain観測は55pass/0fail/0skip。
- `mise run migration-preflight-browser`: 新規task。tests/migration-preflight/playwright.config.tsとconsumer.spec.tsだけを対象にChromium/Firefox/WebKit、worker1/retry0、aube/Biome trial0–5の36行を記録する。
- `mise run migration-preflight-verify`: 新規task。上記Unitの試験/実証拠/C01/schema/環境/CI再利用/適用回帰と固定分母coverage証拠の一致を検査。証拠欠損をskipで通さない。共通検証コマンドとしては別途提示・承認を受けるまで未確定。

U1の実装と過去の36行・CI初回/再利用・完了確認成功資料は保存済み。完了確認スクリプトの修正後、改変拒否と歴史資料/現行sourceの区別に関する35件がmainでpass/0fail/0skip。現在の変更済みsourceに対する全工程の再確認は未検証。外部CI試行は具体workflow/commit/権限/保存先/費用と復帰方法を示して承認後に起動し、local模擬結果で代替しない。

## 完了確認の復旧手順

1. `RECOVERY_EXECUTION_BINDING=.artifacts/migration-session/recovery-execution-binding.json /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 .artifacts/migration-session/verify-completed-result.test.mjs .artifacts/migration-session/aidlc-investigation/reproduce-completion-inventory-drift.test.mjs`で固定証拠と改変拒否を確認する。
2. `--retained-evidence`による歴史資料の成功を、現在のUnitの完了確認に使用しない。既定のcurrent検査は、sourceが変わった古いU2候補を拒否すること。
3. 新規候補を固定し、現在のU1/U2の単体・結合・Node/Worker/3ブラウザconsumer・既存回帰・全第一者JS coverage80%以上をmainで逐次確認する入口を整備する。現在のinstall JSもcoverage分母に残す。未収集・skip・出力不一致・古いsource/pack・不足CI証拠を成功にしない。
4. 実コマンド・必須検査範囲・未完のU3性能/CIを提示し、新しい共通検証コマンドの承認を得てから設定する。必要なCIを省略せず、外部操作は別途具体承認を得る。U3のSHA256改善は、そのU3実装計画の承認が記録されてから実装する。

## Cases and Coverage

証拠集計・取得検証・実行計測の3部品各5–8件以上、baseline境界の結合試験を追加。正常入力と少なくとも2種の失敗/edgeを各部品で確認。digest/ELF/metadata/path/link/duplicate/truncated/サイズ+1/deadline/abort/HTTP/redirect/36行欠落/重複/3000境界を含む。模擬fetchと極小archiveを使い大容量fixtureを不用意に保存しない。

性能trialのELF/wasm/APIは実物、coverage instrumentationなし。coverageは別に固定配布JS全一覧を分母として80%以上を照合し、Worker/別realm欠落を拒否。既存回帰のprobe600s/8項目、aube840s、native完全一致/wasm1GB/worker1/retry0を維持。未変更aubeを再buildせず、未実行は理由付き未検証として停止する。
