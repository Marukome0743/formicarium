# U2 code summary（2026-10-15 再開）

## 今回の変更と現在の証拠

検証済み（固定結果と原ログの読取り照合）：既存C02/C03実装を保持し、U2記録を現在の21JS/31pack候補へ対応づけた。今回の変更は本summary、traceability.json、current-recovery-verification.mdと計画の完了checkboxのみ。source-manifest.jsonの91個別パスは全て存在し、重複なしであるため主張を削除・追加せず保持した。アプリケーションコード、承認済み計画本文・試験指示、U1成果物、封印証拠は変更していない。

固定v5入力SHA256は54b5da8fa4052a6894eab0cc63ee02556252b253d17f6ab8404f1aa5f5afc3bd、結果SHA256は12d6bd4a509ebf374f052067959595d86f5e8c4c24035ef9bea4597e24275ff2。既存の21逐次子コマンドは全てexit0、配布21JSは1768/1929行（91.65%）、1483 realms、skip0。U2 Node44件とChromium/Firefox/WebKit計9件、独立consumer195件、既存Node回帰28件・ブラウザ回帰33件が原ログに記録されている。今回これらのsuiteを再実行したとは主張しない。入力・source・pack・consumer・配信元とログの対応はcurrent-recovery-verification.mdに記録した。

主担当報告ではv5に対する承認済み短時間verifyが成功し、U1 checkpointも通過している。正式U2 checkpointは本記録時点で未完了。currentSourceVerified=trueでもacceptancePassed=false、mergeAllowed=false、laterUnitAcceptance=falseを保持する。現在同一sourceの統合前署名付きCIは未検証、現在候補のU3正式36試行・専用CIは保留。共有SHA256改善は承認済みU3計画で実装済み。U3コードは存在するが未受入れであり、U4/B1、U5開始、公開を許可しない。実機Safariは未検証。

## 実装判断・試験と計画との差分

既存guest私有copy/WeakMap brand、同期SHA256・ELF検証（共有SHA256の承認済みU3改善を含む）、fixture/path/inode検証、唯一のsession予約/token/epoch、取消・cleanupと原子的commitを維持する。追跡表のOKは実装・試験ファイルへの対応であり正式受入れを示さない。品質基準80%、probe600秒、aubeブラウザ840秒、1worker/retry0、probe8項目、native一致、wasm1GBは変更なし。

今回の記録更新に新規テストは追加していない。既存U2単体・consumer・ブラウザ・型試験と全回帰はv5の実観測結果を参照し、再開範囲が記録整合のため再実行していない。計画との差分なし。正式完了確認は主担当が承認済みコマンドで実行する。

## 以下は再開前の履歴（16JS/26pack、現在候補のCI証拠ではない）

以下の「現在」「現」「未完」等は当時のattemptに限る。現在の状態は上記とcurrent-recovery-verification.mdを規範とし、過去のsource/pack・署名付きCIを現在の21JS/31packへ再ラベルしない。

U2 の guest/fixture 検証、session 排他・取消、C03 公開 API を実装した。レビューで見つかった有限symlink再利用の誤拒否を修正し、AI-DLC preview更新を含む現在sourceに対する統合前CI run38438640770/attempt1成功をmainが独立確認した。固定16 JS/1370 realms、1201/1336 lines＝89.89%、threshold80/passed=true。Step9のcanonical command承認・完了確認は未完、U2 acceptancePassed=falseを保持する。

## 履歴：統合前 CI 観測（当時のレビュー修正後）

[run38438640770](https://github.com/Marukome0743/formicarium/actions/runs/38438640770) attempt1、job115439127501はsuccess。head d9beae83ba98e5bffdd6ae3653e40da4f47612c1はGitHub署名Verified。sourceIdentity e8a6105297897a01bf1d1b636d81b1c3c2078ef5d40cb78b3982b736e139725f、pack SHA c2d801b1f0abb8bac8aa619778844b8979a6c7ed9d69267fc58b4607c180a245。現在の277 sourceFiles全件とCI一覧、署名後の新local candidate/独立consumer packが一致した。

artifact11836212352は211870 bytes、ZIP SHA 4a63b7d55bd3ff16f00ae098abbde60a851d83b6c755710272613da134b695c9がGitHub digestと一致。全16 file line mapから1201/1336と89.89%を独立再計算し、1370 realm名の重複なし、threshold80/passed=trueを確認。observed summary SHAは3b0d190609a1322a2c1d6b7bf41656ea7c981aaa9132284ee6ab59b53607d8d3。同recordのci-observed-38438640770.jsonとci-trial-38438640770.logを参照。rawは.artifacts/migration-session/ci-evidence-38438640770/に保存。

CI入口10件、unit177 pass/既存known skip2、tooling236、U2 Node44/browser9、consumer189、Node build/probe/aube28、browser probe/aube33が成功。計測Node package115/U2 44、browser package99/U2 9も成功。既存skip2は成功件数へ加算しない。実機Safariは未検証、U3/U4/C06/B1・公開は未受入。

fixtureToFsEntriesのactiveリンク集合をリンク自身のtarget解決中に限定し、caller suffixの有限な2回/3回再利用を受理する。修正前の新回帰1失敗をmainで観測し、修正後fixture9件とU2 Node44/browser9を成功。自己・相互・parent-component循環/root脱出/非directory親の拒否を維持。

## 過去の統合前 CI 観測（修正前source）

[run38393506506](https://github.com/Marukome0743/formicarium/actions/runs/38393506506) の head は `268b323d96bfbcd2eb2fe0e03d5941eedc033871`（GitHub署名Verified）、sourceIdentity は `93e5957fccb5e862c13f8f1f56a10e97699ee64214004b9ce9a9f7d77f6f17de`、fresh pack SHA256 は `e68fec9379c70008dd43d4980bd756336b94297c1dd376f0e1aabbc3297a2ae0`。以前の local source/packへ再ラベルせず、CIの実head、新stage、独立consumerと逐次suite/全realmを別の証拠として記録する。

main は artifact11814487608 の ZIP を取得し、SHA256 `a10834eca73b5ca5e904cec4d8c645d62d861f6dd3dc5532905d71f2bf769b83` の一致を観測した。展開先は `.artifacts/migration-session/ci-evidence-38393506506/`。`completion-090b4c8e-9359-463d-b5ed-8961217ab900/coverage/coverage-report.json` は固定16 files/1370 realms、1199/1334 lines＝89.88%。raw Node/browser realms、mapping metadata、候補manifest、core復元receiptも保持する。main の独立相互照合 `verify-ci-evidence.mjs` はexit0で、同recordの `ci-observed-38393506506.json`、実ログ `ci-trial-38393506506.log` に保存済み。job内部 `checksCompleted=true` だけを最終受入根拠にしない。

CIの `ci-job-observations.json` は実assembly日時 `2026-10-13T12:44:45.915Z`、acceptancePassed=false、jobConclusionは独立GitHub API観測を要求する。Step9 canonical承認・レビュー/checkpoint、実機Safari、U3/U4/C06/B1と公開は未完/未検証。下記のCI未検証という記述は、その時点の過去 local attempt の状態として保持する。

## 変更

- runtime/guest-validation.ts と生成 JS：同期 SHA256/canonical metadata、全 ELF/metadata identity、容量境界、private WeakMap handle、fixture copy/path/link/hardlink 検証。
- runtime/state.ts、lifecycle.ts、session-port.ts と生成 JS：token/epoch、単一予約、atomic guest registry、予約済み継続、reset/dispose 取消と有限 Worker cleanup。C02 は公開 exports に含めない。
- runtime/public.ts と生成 JS、types/index.d.ts：C03 の validateGuest/fixtureToFsEntries/runValidatedGuest/registerValidatedGuest と型。
- package.json の files、scripts/package/stage-package.ts/JS と coverage-inventory.json：新 2 JS を含む固定 16 配布 inventory。root 版は変更しない。
- tests/migration-session/ と生成 JS：guest 9、fixture 9、reservation 10、public 8、実 consumer 8、三ブラウザ 3 ケース、型 fixture、completion 境界 3（fake executor を明示）。tests/package/lifecycle.test.ts/JS は承認済み reset 取消仕様に従い旧 reset BUSY 期待のみ変更。
- scripts/migration-session/ と生成 JS、mise.toml：staging 0.3.0 pack、working source inventory、逐次 completion、追加 coverage 収集。README.md/docs/terrarium-integration.md は API と制約・候補状態を説明。
- scripts/migration-session/{ci,ci-inputs,ci-core}.ts/生成JS、tests/migration-session/ci.test.ts/生成JS、専用 migration-session-u2.yml：固定task adapter、19 destination/全SHA/capを要求するbranch-owned payload、固定Git object bundleのnetworkなし復元、実CI head/source/pack結合、独立consumer、raw realm artifact。setup-bun後に絶対path/実行可能/version1.4.2を検証し BUN_EXECUTABLEを登録する。
- tests/package/{public,coverage,pack}.test.ts/JS、tests/terrarium/{coverage,current-candidate}.test.ts/JS：承認済み7 export、現16 JS/26 pack files と歴史14 JS/24 coverage の境界を明示する。旧証拠の入力を現候補の証拠へ再ラベルしない。
- scripts/release/{inventory,publication,publication-cli}.ts/JS、tests/release/publication-alignment-fixture.ts/JS、tests/tooling/{publication-alignment,publication-version}.test.ts/JS：現配布の準備と歴史的公開 proof を分離し、現 U2 公開を fail closed にする。正式 generator により .github/publication/{runner.mjs,bootstrap.mjs,runner-manifest.json} を main が再生成・独立再生成照合した。

## 決定と境界

caller の固定カタログから GuestExpectation を渡す。未知 metadata field も canonical digest に含める。入力 byte/metadata を内部 copy し、公開 handle の構造を複製して権限を作れない。JSON 重複 key は raw JSON 所有者の責務であり、U2 object API が復元したとは主張しない。

既存 raw run の guest 非ゼロ結果、snapshot、timeout、Worker cleanup を維持する。reset は取消・cleanup 後に seed FS/cwd を復元し registry を消去する。登録、run、FS は同じ session 予約を使い内部継続は二重 acquire しない。

暫定 candidate は staging 内の 0.3.0。sourceCommit は base revision として明示し、実 working source の SHA inventory を別に bind する。公開 0.2.1 pack と変更前 JS14/型3 は main で一致確認したが、core assets は Emscripten 6.0.12/6.0.10 で byte 不一致である。原因を compiler 版だけと断定しない。新 candidate 自身で検証する。

coverage は固定16 JS（未 import は0）を分母にする。既存 25 Node Worker/33 browser ケースを保持し、U2 Node Worker 5 と browser 17/0/17 Worker を厳密検査する。runtime/node/api.ts と lifecycle.ts が同期 spawn するため、取消 consumer ケースにも実 Worker が存在する。前回の4という予定値は誤りであり、実5件を削除せず保持する。新 consumer ケースは最初の実 byte output の Promise barrier 後に reset し、Worker bootstrap を実行したことを確かめてから取消と再利用を検査する。即時取消は既存 reservation 試験を保持する。host が登録 bit や product counter を書いて成功に見せることはしない。実 pack/installed byte を先に照合し、instrumented copy は別の収集境界として記録する。foreign-instance 試験は元 installed package を保持する。

## main の観測済み結果

正確なコマンド・失敗/Retry 履歴・候補 path は observed-verification.md に記録される。

- runner-ready 3 成功、build/typecheck 成功。
- guest/fixture 17 成功（128 MiB/256 MiB 境界を含む）。
- reservation + 既存 state/lifecycle 33 成功（新 reservation 10）。
- public 8、独立 Node consumer 8 成功。
- 同一新 pack の Chromium/Firefox/WebKit 9 成功、17.5 秒、worker 1/retry 0。

前回の path Retry は source identity `bfd874b51fd00605b48e10c94e12935f4aaad6e61c5f96f9ad8d0175b68d5d49`、candidate `0fba587c...`、独立 consumer `de8cce69...` へ bind して main が実行した。以下はその attempt の観測であり、最終集計は取消 Worker の未登録で失敗した。略記 path の完全値と pack SHA は observed-verification.md の実コマンドを参照する。

- build/typecheck 成功、stage の固定16 JS/26 files と独立 installed bytes を照合済み。
- coverage helper の guest path を `resolve(root, envPath)` で absolute にし、fresh path-check の専用 browser discovery で9件を確認した。
- 現再試行の test-light：unit 177 pass/0 fail/既存 known skip 2、tooling 236 pass/0 fail。
- 現再試行の U2 Node 43 pass、三ブラウザ9 pass、既存 consumer189 pass、Node build/probe/aube28 pass、三ブラウザ probe/aube33 pass。
- その再試行の measured package Node115、measured U2 Node43、package browser99、U2 browser9は全pass。最終80% reportは取消 Workerの未登録により非成功。

既存 known skip2 は成功件数へ含めず、統合前 CI と同様に checkpoint で明示する。前の path失敗 attempt で measured U2 Node43 と package browser99 が成功していても、現再試行の証拠へ流用しない。

## 過去の失敗・診断と local 完了結果

### Worker 集計修正の main 境界検証と診断

修正後の format/build/typecheck は exit0、completion 境界6件は188.987916 msで成功、非計測の独立 consumer8件は6690.538292 msで成功した。fresh 診断 copy の consumer8件は292440.111708 msで成功し、5 Workerすべてで実 bootstrap bit1を観測した。各 Worker の非ゼロ statement数は230/230/230/184/230で、取消 Workerも実測値として残る。

診断集計は固定16 files、1199/1334 lines＝89.88%で成功した。ただし prior host/fresh hostの明示した max union、prior package Node/browserの provenance付きコピーを使用した診断である。新 source の最終coverageや受入証拠ではなく、過去outputを上書きしていない。前回の source `bfd874b...` では measured U2 Node43/package browser99/U2 browser9が全成功し、最終集計だけが未登録 Workerで失敗した。

main は新 source identity `6d6be261d196a83a0774f289ad56ef019923dfa819e4c79b697953ce0efece98`、candidate `49df6ae6-977f-4cad-9391-633083a2cd1c`、独立 consumer `2c80314e-8bd9-473c-b564-9305d69d360b` の fresh full retry を exit0で完了した。packは同じ実16 JS/26filesだが、source/試験と測定 attemptは新規であり、前の結果を流用していない。完全 path/pack SHA/コマンドは observed-verification.md を参照する。

fresh測定：package Node115 pass（6540.33075 ms）、U2 Node43 pass（743312.092125 ms）、package browser99 pass（9.1分）、U2 browser9 pass（9.3分）。`.artifacts/migration-session/completion-d3a2ae8c-d7c2-421d-8360-30ba2e63c8f6/coverage/coverage-report.json` は固定16 files/1370 realms、1199/1334 lines＝89.88%、threshold80/passed=true。local-provisional-report は実 assembly日時 `2026-10-13T10:47:31.682Z`、localPassed=true/acceptancePassed=false、統合前CI未検証を記録する。診断 max unionを使った89.88%とは別の fresh全試験・全realmの最終local結果である。Step8/9はCI/canonical承認待ちのため未完を保持する。

取消 Worker の集計修正前 attempt（source `bfd874b...`）では全 Node/browser 試験が成功した後、最終集計で5 Node Workerのうち4番目が bootstrap 未登録・全0であると判明した。誤った exact4 予定値だけを5へ広げても未登録拒否が残るため、ユーザー承認の下で上記の実 output barrier と exact5検査を実装した。既存 tests/migration-session/completion.test.ts に missing/extra/duplicate/未登録の拒否と entered cancellation Workerの保持を確認する狭い回帰3件を追加した。新 runner/task/試験指示は追加・変更していない。この修正の build・境界試験・診断・fresh full retryは上記のとおり成功した。過去測定 byte は診断にだけ用い、新 source の final local結果へ流用していない。

test-light の既存 export/固定一覧期待を新 C03 の7 export/現16 JSへ合わせた。歴史的 Terrarium/release coverage は明示した旧14 JS/旧24固定一覧へ分離した。配布一覧の17既存失敗に対する修正では publication 準備を16 JS/26 pack filesへ同期し、既存公開 gate は現 U2 pack を新 module proof不足で拒否する。歴史的24 pack の mocked 正例を明示固定し、現26 pack＋歴史24coverageでは executor 0 を検査する負例を追加した。正式 bundle generator の generate/verify と tooling236は main が成功を観測済み。任意の追加 evidence field による公開権限の拡張はしない。

過去の失敗は記録を保持する：型 fixture の注釈位置、browser webServer cwd、旧 export/分母期待、publication 旧一覧、fixture rename 残り、consumer 旧 count2件、coverage helper の相対 guest path。各失敗後の Retry 承認に従って scoped 修正・再生成・新 staging/独立 consumer・再実行を行った。生成済み coverage output や凍結 U1 report の手編集で通していない。

共通 local command は人の承認済みで main 実行成功。固定16 JS coverage ≥80% の最終local観測は完了し、その後の上記CI source/packでも統合前CI成功を実観測した。canonical承認は未完。traceability.json の OK は実装/試験ファイルへの対応であり、U2最終受入を示すものではない。

最終 completion は CI 入力が欠ければ重い処理前に拒否する。明示した local-only モードは local-provisional-report.json に acceptancePassed=false と CI 未検証を保存し、U2 最終受入へ昇格しない。実機 Safari、U3 install/U4 command/C06/B1、実公開は未検証/対象外。U1 の source/実36試行/CI 証拠は変更していない。

計画本文・Testing Contract・試験指示は変更していない。Step1–8 の実完了だけを tick し、Step9 は canonical承認/完了確認前のため未完を保持する。専用branchのblob/input manifestと検証に必須の既存依存閉包は main の隔離checkout記録で追跡し、主workspaceのignored scratchを製品source claimへ含めない。
