# U2 現在証拠の照合（2026-10-15）

## 範囲と状態

検証済み：承認済み再開計画Step9/10として、既存実装・固定v5入力・結果・原ログを読取り照合した。アプリケーションコードと封印証拠は変更していない。suiteの新規実行は行っていない。主担当からv5の承認済み短時間verifyとU1 checkpoint成功を受領したが、正式U2 checkpointはこの記録時点では未実行。

## 固定入力と結果

| 対象 | パス又は値 |
|---|---|
| 入力 | `.artifacts/migration-preflight/current-recovery-input-20261015-v5.json` |
| 入力SHA256 | `54b5da8fa4052a6894eab0cc63ee02556252b253d17f6ab8404f1aa5f5afc3bd` |
| 結果 | `.artifacts/migration-preflight/current-completion-055093d2-bbde-4851-8566-663a68c1e8bd/current-local-verification-report.json` |
| 結果SHA256 | `12d6bd4a509ebf374f052067959595d86f5e8c4c24035ef9bea4597e24275ff2` |
| 実行期間 | `2026-10-15T11:06:12.240Z`–`2026-10-15T12:11:43.979Z`（JST 10月15日20:06–21:11） |
| sourceIdentity | `2d449d46138cb20b7cd76b1657ab936febefea1c0c0b81e9b2983704b8e4c096` |
| currentSourceIdentity | `3ed2770f3a19c4ba6bad598dff6d4610a5610e61f20f7464dc12121ec6a0a362` |
| pack SHA256 | `cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2` |
| coverage SHA256 | `23d7be0214271c85e450138985a3b0519207a0b6dbeac60de397dd9fa39ed422` |

検証済み（読取り照合）：入力・結果のSHA256は上記と一致。結果の394 source rows、407 evidence rows、入力のactualSite全file rowsについて実ファイルSHA256と一致し、不一致0。候補は`.artifacts/migration-install/candidate-6d64046e-ac07-434b-9489-2f8c57d0e7d1/package.manifest.json`（manifest SHA256 `83b61001dac4f8998999ce7901f74aef637450dfb7d141910fe711682477b598`）。31 pack files、21第一者配布JSを対象とする。sourceCommit `74dd4477ac8f28da5dd7467eac5ecb837893ce8d` はbase revisionであり、現在のworking source全体が同commitに収録されているという主張ではない。

独立consumerは`/private/tmp/formicarium-u3-final-consumer-20261015`、guestは`.artifacts/u2-release-inputs/aube-v2.7.0/aube`（SHA256 `c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e`）、配信元は`.artifacts/u2-guest-distribution/site-repair-v1`として入力に固定される。正式verifyが候補/installed bytes・全raw realm・追加/削除を含む配信元・現在sourceの結合を再検査する。

## 既存実観測ログの対応

以下は上記結果の`commands`と同じ出力ディレクトリにある`command-N.log`を照合した結果であり、今回の新規suite実行ではない。21子コマンドは全てexit0、結果自体もexitCode0/signal=null。

| 工程/原ログ | 観測 |
|---|---|
| 1 | 歴史的U2署名付きCI/完了証拠の保持検証 |
| 2–3 | build/typecheck成功 |
| 4–5 | U1単体55、current-entry17成功 |
| 6–7 | 軽量185/tooling237、acceptance/CI境界23成功 |
| 8 | U2 Node44成功、fail/cancel/skip/todo0 |
| 9 | install Node74成功 |
| 10 | U2 Chromium/Firefox/WebKit計9成功（17.4秒） |
| 11 | installブラウザ45成功（consumer9＋SHA vector回帰36。正式HTTPS36試行とは別） |
| 12–14 | 独立consumer195、Node core回帰28、ブラウザ回帰33成功 |
| 15–17 | coverage準備、計測package Node115、計測U2/install Node115成功 |
| 18–20 | 計測packageブラウザ99、U2ブラウザ9、installブラウザ9成功 |
| 21 | coverage report成功 |

`coverage/coverage-report.json`は21JS、1768/1929行（91.65%）、1483 realms、threshold80、passed=true、skipped0。旧16JS証拠への分母差替えはしていない。記録された原ログのSHA256も結果の封印rowsと一致する。raw counter検証を含む最終判定は承認済みcurrent-completion verifierの責任とし、単なるreport.passedだけで完了させない。

## 実装・追跡と書込み一覧

ドキュメント根拠と実装読取り：C03は`runtime/guest-validation.ts`の私有WeakMap、検証copy、同期SHA256/ELF、fixture正規化/有限link解決と`runtime/public.ts`の公開消費経路に対応する。C02は`runtime/state.ts`のtoken/epoch/active検査と所有release、`runtime/lifecycle.ts`の共通予約・reset/dispose cleanup、非公開`runtime/session-port.ts`に対応する。詳細のFR2/5/6、BR2.1–11、U2詳細NFRの対応は`traceability.json`に保持する。OKは実装/試験ファイルへの対応を示し、最終受入れ状態を表さない。

`source-manifest.json`の91個別パスは全件存在し重複なし。既存主張を保持し、directory、glob、`.js.map`、ignored scratchへ拡大・縮小していない。今回新たなアプリケーション書込みはないため一覧内容の変更は不要。NFR2.1の追跡先を既存core/memory試験、NFR2.2を実際の配布coverage実装へ対応づけ直した。

編集対象のU2 summary/traceability/manifest/本資料は、v5入力のcurrentSource/historicalFiles、結果のevidenceFiles、保持U2 recovery-execution-bindingのevidenceFilesに含まれていないことを読取り確認した。封印対象やU1成果物を改変していない。

## 歴史証拠と残る条件

旧U2は16JS/26pack、1370 realms、1201/1336行（89.89%）、署名付きCI run38438640770/head `d9beae83ba98e5bffdd6ae3653e40da4f47612c1`の履歴である。保持結果`.artifacts/migration-session/completion-628a2334-009d-4685-9d50-1a08cb96f12c/completion-report.json`のSHA256は`2077503099d1fcd7f70038af37b03b42b5ca26f731d07f06d324a7e50f48038a`。旧sourceIdentity/packと現在候補は異なり、このCI成功を現在sourceの成功へ読み替えない。U1旧36試行/固定Biome CIも元の入力・期間の証拠として保持する。

現在結果は`currentSourceVerified:true`、`acceptancePassed:false`、`mergeAllowed:false`、`laterUnitAcceptance:false`。未検証/保留は、現在同一sourceの統合前署名付きCI、現在候補のU3正式36試行の非DL中央値≤3000ms、U3専用署名付きCI。共有SHA256改善は承認済みU3計画で既に実装済みであり、固定report.pendingの`U3 implementation-plan approval`という過去文言は生証拠のまま保持し、現在の実装進捗と区別する。U3のCI実配信入力の不足修正と再検証は後続作業として残る。U3コードの存在と正式受入れは区別する。U4統合C06/B1、U5正式着手、公開へ進める証拠ではない。実機Safariは未検証。

正式U2 checkpointは主担当が変更していないレコード直下`verification-command.txt`を使う。失敗・source drift・新入力/コマンドの必要があれば停止して確認する。重い21工程再実行、push、CI試行、U3性能改善、証明書登録は今回行わない。

## 旧v4とU3性能証拠の境界

旧v4入力 `current-recovery-input-20261015-v4.json`（SHA256 `4ea97606f1cbfe4a20044edd170c037087191dd09468b4cda62cdf1a2e75df57`）、結果 `current-completion-afad95db-b298-4627-8882-36e633389e9e/current-local-verification-report.json`（SHA256 `a3a9a207d69fcfed1c9522455bc22eb43db082acb7ab0d22d91180f8838b740c`）は1755/1916行（91.59%）の履歴であり、現在のv5 source/packへ転用しない。旧v4と封印済み証拠は変更していない。

ドキュメント根拠（主担当引継ぎ）：U3の `formal36-sha-20261015-v2` はREADME更新前のpack `d3df...` に対する成功履歴であり、現在pack `cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2` の正式36試行ではない。v5工程11の45件はconsumer9件＋SHA vector回帰36件で、正式HTTPS36試行と件数だけで混同しない。

現在の承認済み `verification-command.txt` のcommand SHA256（前後空白を除いたコマンド文字列）は `5a7148debea2915ee964a4e97e61f2fa2d279285c6a2a5b37dbf5e89f9312c24`。読取り照合で一致し、本作業で変更していない。
