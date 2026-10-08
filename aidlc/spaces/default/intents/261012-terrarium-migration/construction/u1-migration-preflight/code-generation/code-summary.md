# U1 Code Summary

Status: 現在コードのU1/U2 local回帰確認がmainで成功。独立レビュー・正式checkpoint受入は未完。R01/R02は未解消。

## 現在コードの完了確認の復旧（2026-10-15）

検証済み：`current-completion.ts` のprepare/run/verifyを分離し、新候補・独立consumer・固定guest・実配信site全ファイル・現在source390件・歴史証拠をSHA256で固定した。実childだけを順次実行し、欠落・改変・skip・非zero・古いsource/packを拒否する。短いverifyも同じ入力・結果・全raw証拠・exact commands・時刻・current source/pack/consumerを照合し、生counterからcoverageをread-onlyで再計算する。模擬executorの成功では正式証拠を生成しない。

現在21JS/31filesの配布一覧とpackage/terrarium/publication試験を整合した。歴史U1の14JS、U2の16JS、旧coverage・CI・原資料は保持し、現在の成功へ再ラベルしない。publicationの既存gateは新install入り候補を引き続き拒否する。releaseの固定Bun/Biomeでpublication runnerを再生成し、実配信試験に必須の`U2_ACTUAL_SITE`を固定入力へ封印した。旧U2専用completionの16JS境界は変更せず、現在候補には使用しない。

計測中のInt32 overflowは、coverage bridgeで非負safe integerだけを受け入れ、2147483647で飽和させることで修正した。飽和値は実行頻度の下限であり、厳密な頻度ではない。未実行0と行coverage判定は維持し、aggregateとcurrent verifierは負のraw counterを拒否する。旧負数資料を補正せず、新規v4試行で確認した。本番SHA256処理は変更していない。

main観測：2026-10-14T21:44:58.257Z〜22:53:07.199Z（JST 10月15日06:44〜07:53）、21子工程すべてexit0、最後のraw検査も成功。全21JSのcoverageは1755/1916行＝91.59%、skipped0、1483realms、401証拠ファイル。U1単体55件・新current17件・U2単体44件・install単体60件・通常consumer195件、Node coverage115+101件、browser coverage99+9+9件を実行。test-lightは185件＋tooling237件、通常browser U2/U3各9件、既存browser回帰33件も成功した。詳細と固定SHAは`current-recovery-verification.md`。

受入境界：`currentSourceVerified=true`は現在のU1/U2 local回帰の証拠であり、`acceptancePassed=false`、`mergeAllowed=false`、`laterUnitAcceptance=false`。歴史CIは当時の同source/pack・署名を検査しただけで、現在sourceの新CIではない。U3性能36試行・U3専用CI・現在sourceの統合前CI/merge・U3改善計画の正式実装前承認はpending。実機Safariは未検証。

openレビュー：R01 Major（baseline cache metadataの上限/重複JSON）とR02 Minor（tarの同期展開中の取消分割）は今回変更対象外で未解消。R03 Minorの「現在入口未検証」は今回の全工程証拠で検査可能になったが、解消判定は独立レビューに委ねる。新CIやU3受入が完了したとはしない。

以下は当初U1実装・受入資料の履歴であり、固定14JSの結果を現在21JSの証拠として使用しない。旧`main-verification.md`・`final-verification.md`・歴史証拠ディレクトリは書き換えていない。

## 実装

scripts/migration-preflight の evidence/assets/runner は C01 の36行集計、固定 guest の安全取得・ELF/metadata検査、fresh session の工程計測を実装。prepare-mirror は公式 byte pins を保つ localhost HTTPS 検証入力を用意する。verify は JSON duplicate key を拒否し、実入力・CI first/reuse receipts・受入 byte・必須試験記録・固定14JS coverage を全 AND で照合する。

baseline は固定 Biome commit と immutable Rust image を使い、全入力 key、single writer、staging/atomic acceptance、同 key 再利用、4時間 deadline を実装。実 CI 初回で make 不在が判明したため、一次確認した Alpine make 4.4.1-r4 の APK digest を追加し、同じ build container で署名検証付きの offline install と版照合を行う。公開 product runtime/core API は変更していない。

tests/migration-preflight の server は厳密 allowlist/COI/CSP/no-store/TLS 検証維持を備える。元コア SHA が既存 package pins と一致することを確認し、assetDigests は専用 immutable HTTP 応答だけへ補完した。元 dist byte は維持する。consumer は失敗行も別 artifact に保存し、欠落時間をゼロで補わない。

## 観測済み

- main baseline: build/typecheck/light、consumer189件、Node回帰28件、既存 browser回帰33件成功。
- 新規六部品の unit suite は make 修正後52件成功（evidence9/assets9/runner8/prepare-mirror8/baseline10/verify8）。これは fixture suite。
- 実 HTTPS mirror browser36件成功、非ダウンロード工程の六中央値479.74–710.3ms。試行 source75e4adf0a51db8fcc1af25676d54fc81fa09efee。原 trial JSON と環境を保存済み。
- 実 CI run38311656181 は commit b6921789c70cecf45635f1b22524dc8abf8698db、39m21s、first compileSkipped=false / reuse=true / versionExitCode0。同 ELF SHA256は256fe184205f99a4652691f18098b0e2ceff0e676083baf7077dca68ce3b77c9。
- build/typecheck/bundle構文/bash構文の main 成功記録あり。一時証明書削除・不存在確認済み。

最終 browser 回帰33件は main で41.4秒・成功を観測済み。固定14JS coverageはNode115件とブラウザ99件が成功、982行中862行（87.78%）、skipped0、1253realmsで合格した。completion.ts は live build/typecheck/unit/consumer/Node/browser/固定14JS coverage/実証拠照合を逐次実行する入口として作成した。入力名配列のTS7053で一度停止後、ユーザー承認によりas constを追加し、build/typecheck exit0、55pass/0fail/0skip（追加3境界を含む）を観測した。必須入力欠落、子失敗で後続停止、同時重複拒否を検証済み。入口全体のlive実行は初回コマンドの人間承認前なので未実施。

証拠は main-verification.md、baseline-verification.md、baseline-input-observations.md、および docs/results/terrarium-migration-preflight-evidence/ を参照。以後の最終coverageと入口の結果は main が実観測後に更新する。

共通コマンドをユーザーが承認後、mainで変更せず実行しexit0。build/typecheck、単体55件、consumer189件、Node回帰28件、ブラウザ回帰、coverage Node収集・ブラウザ99件、実証拠照合まで成功した。最終coverageは87.78%、982行中862行、skipped0、1253realms。詳細はcompletion-verification.md。共通入口のlive実行を未実施とした上記の記載は承認前の履歴であり、現在は検証済み。

## 未完と境界

source-manifest.jsonはstrict schemaの変更対象pathを列挙し、SHA/revisionは別観測記録へ保存する。共通コマンドは live unit/integration/E2E/coverage を実行する入口案であり、verify の歴史記録照合だけを完了確認としない。実36行・CI proof・既存回帰・実pack固定coverageをまとめたverification-input.jsonを実verify入口で照合し、exit0「U1 evidence acceptance passed」を観測した。証明書の再登録は不要。OS process group の実取消試験、実 Safari、他アプリ負荷計測は未検証。U1 独立レビュー・受入はまだ行っていない。
