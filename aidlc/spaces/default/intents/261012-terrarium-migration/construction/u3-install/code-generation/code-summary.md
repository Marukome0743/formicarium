# U3 install コード実装・検証概要

## Status

現在の作業はCI run38766787639の計測付きNode TIMEOUTに対する共有collector修正。mainがRED（13tests・12pass・1fail、Atomic.load増分2049/期待0、全2048counter/store値一致）を観測し、承認済みのgetter局所値・毎setter Atomic.storeへ最小変更した。検証済み：対象coverage17件・acceptance32件・実配信8件に加え、新候補の全18工程exit0、全21JS coverage1768/1929=91.65%・skip0、正式36試行成功（最大組中央値2633.08ms）。証明書一時登録・計測・削除wrapper exit0、別途find exit44で未登録確認済み。source8897cea442a680b469c474b0a8164175b5499a48f200cc1bd6eb8f7f4054967c、manifest f229d672ea9093659447a32b98af33031a384937c69ddb82d2955ef2f5e689f5、候補814696a5、pack cc89（製品bytes不変）。追加署名付きpush/CIは未実施で、U3正式完了ではない。詳細は [collector-single-writer-recovery.md](collector-single-writer-recovery.md)。以下のeb50 source・ccbd headのローカル成功は修正前の履歴として保持する。

2026-10-16更新。検証済み：CI入力修正後の新候補について、mainの非TLS18工程は全exit0。全21JSの行coverageは1768/1929=91.65%、skip0。固定サイト復元と実配信8pass・skip0、同source/packの正式36試行も成功し、6組すべての非download中央値が3000ms以下。mainの証明書一時登録・計測・削除wrapperはexit0、削除後の未登録も確認済み。署名付きU3 CI・独立最終レビュー・正式完了確認は未完了で、U3正式受入れの完了は主張しない。実機Safariは未検証。

## Files Created or Modified

- scripts/package/coverage.ts/生成JS、tests/package/coverage.test.ts/生成JS：共有bridgeの単一writer確認に基づくgetter Atomic.load反復削減と、counter列・realm独立性・中断後host可視性の回帰。生成JSはmain buildだけで更新する。U3 manifestへ4個別パスを追加した。

- runtime/install-catalog.ts、install-transfer.ts、install-archive.ts、install-lifecycle.ts、install.tsと各生成JS：caller catalogの固定snapshot、有限HTTPS取得、全archive検査、取消・通知・原子的登録。
- runtime/public.ts/生成JS、types/index.d.ts：既存公開entryからC04を公開し、内部SessionPortを非公開のまま利用。
- runtime/guest-validation.ts/生成JS：承認済みStep 7のSHA256状態読出し・更新だけを最適化。8要素の直接読出しと直接加算へ変更した。
- package.json、scripts/package/stage-package.ts/生成JS、coverage-inventory.json：installの5個のJSを含む21配布JS・31packファイルの固定一覧。
- scripts/migration-installのstage/completion/coverage/measure/ci/ci-inputsと生成JS、専用workflow、mise.toml、tsconfig.tests.json：独立候補、固定入力、逐次実行、全realm収集、36試行、専用CIの入口。mainがCI入力bundleをprepare/inspectし成功した。
- ci/migration-install/inputs.bundle.jsonとpayload21bin、ci/migration-session/inputs.bundle.jsonとpayload18bin：固定core/guest等と追加圧縮サイトの再現入力。従来の40ファイルに新archiveのblob1件を追加し、計41個別CIパスをclaimする。新blobのjj追跡はmain側の確認事項。
- tests/migration-installのcatalog/transfer/archive/lifecycle/public/consumer/runner/acceptance/型fixtureと生成JS：部品別境界、独立tarball consumer、型契約、検証入口。
- hash-regression.test.ts/生成JS、hash-regression.spec.ts/生成JS、browser-modules.d.ts、playwright.config.ts：Node crypto/WebCryptoの独立照合と境界・非破壊回帰。

- README.md、docs/install-api.md：実装済みのC04 API、caller catalog、取得・上限・取消・進捗・エラー・利用例と未完了の受入範囲を説明。READMEのinstallを後続扱いする文を更新し、U4 commandは後続のまま保持する。

個別の実ファイル110件（共有collector変更4件、.gitignore、CI入力41ファイルを含む）をsource-manifest.jsonに列挙した。ディレクトリ・glob・.js.mapのclaimはない。JSはmainの承認済みbuildが生成し、手修正していない。.gitignoreにはU3生成JS24個の個別例外を追加し、U2既存例外と.js.map除外を維持した。従来の対象生成JS27個とCI入力41ファイルの追跡観測は保持し、最新共有変更の追跡確認はmainが行う。Step 11全体は未完了である。

## Implementation Decisions

ドキュメント根拠：C02の予約・epoch・cleanupを所有者へ委任し、public登録への再acquireを避ける。catalog/metadataをcopy・検証し、HTTPS credential omit・有限redirect・受信上限・deadlineを維持する。tarはホストFSへ展開せず全entryとリンクを検査する。失敗前の旧guestを保持し、真正C03 handleだけをcommitする。

Step 7では64round、全block、padding、endianness、全ELF・metadata hash、所有copy、buildKey照合、同期C03、private brandに変更を加えていない。Node14件と各browser12件の新SHA回帰は最適化後に作成した（tool-produced Testing Contractのtest-after）。README更新前候補の実36試行は下記の全中央値3秒以下を観測した。文書更新後の候補へ自動適用しない。

Node unit入口は個別8ファイル、通常browser入口はconsumerとhash-regressionの2specへ整合。instrumented NodeにもSHA回帰を加えた。instrumented browserは既存consumer collectorと固定realm期待集合を維持し、独立SHA照合は通常browserで実行する。coverage除外・品質限界の緩和は追加していない。

## Test Coverage Summary

次はmain sessionが逐次実行し、本担当へ報告した観測結果である。本担当はbuild/testを実行していない。

| 実行 | 観測結果 |
|---|---|
| mise run build | exit 0 |
| mise run typecheck | exit 0 |
| U3 runner-ready | 3 pass |
| Node独立SHA回帰 | 14 pass |
| 共有C03/fixture/public・U3 public/acceptance | 47 pass |
| U3 unit aggregate | 74 pass、fail/skip 0 |
| U3 browser consumer + SHA、Chromium/Firefox/WebKit | 45 pass、42.2秒 |

browser初回はsandboxの起動制限Permission denied (1100)により45件失敗した。製品成功へ数えず、mainが人間の承認後に同候補・ホスト権限で再実行し45件成功を確認した。

SHA回帰は空/abc/既知multi-block vector、55/56/63/64/65と127/128/129byte境界、65537byte binary、offset付きview、入力非破壊を独立実装で照合する。Nodeでは100万aの既知vectorも確認した。consumerは実ELF/archive導入、取消、競合、偽造session等の既存試験を継続する。

## Candidate and Evidence Boundary

正式36試行は .artifacts/migration-install/formal36-reference-20261016/measurement-report.json、SHA256=68b35055713621e07de6ac57851e1a096ba973ff2a05d0faf776330db9bdd975。recordedAt=2026-10-15T16:03:26.594Z、source identity=eb50f0266503138e68569f5e6084da8f4c1e6903c063f07a7365606b1f82804e、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2、trialCount=36、passed=trueをread-onlyで確認した。全trial exit0/CORS passedで、mainはTLS検証を省略せず実行。非download中央値(ms)はaube Chromium785.73/Firefox1747.50/WebKit752.08、Biome Chromium1053.685/Firefox2661.84/WebKit1045.94。mainのrun-reference-formal36.shはexit0、Temporary localhost trust/certificate removedと削除後find exit44を確認し、現在有効な登録・実行待ちはない。

現在の候補は .artifacts/migration-install/candidate-536a358f-541e-47f7-a288-f944f653c204/package.manifest.json、contextは .artifacts/migration-install/reference-local-context-20261015.json。source identity=eb50f0266503138e68569f5e6084da8f4c1e6903c063f07a7365606b1f82804e、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2。製品pack bytesは旧候補と同じだが、source identityは修正後のもの。

非TLS18工程のレポートは .artifacts/migration-install/reference-regressions-5908a7fa-fd16-487f-96ce-9592ac915803/regression-report.json、SHA256=33d657b8842755c9e48a3df5c61e7f3795a2e0f6102571abf29aa45ffe30485b。全18件のexit0と各raw log SHAを本担当がread-only再確認した。軽量185+237、acceptance/CI42、U2 unit44、U3 unit74、独立consumer195、Node回帰28、通常browser U2=9/U3=45/既存回帰33、instrumented Node115+115、instrumented browser99+9+9。全Node summaryのfail/cancel/skip/TODOは0。coverageは全21JS・1768/1929行=91.65%・skip0。reportのacceptancePassed=false、formal36/signedCI=pendingを保持する。

現在のCI入力修正の詳細は [ci-reference-recovery-verification.md](ci-reference-recovery-verification.md)。新canonical manifest SHA256=211041688ff38a16eb449d37263030543a3c7655e23a0dd9ec7e7886b15a0ae6、22logical行・254668126bytes・330source rows。10件archiveは36727106bytes、SHA256=9c0dd08a854487501c5b2dcd2dc9ce5f703bddf993fc0156586776c2cf63307f。既存dist/guests/aubeだけを固定参照して全11ファイルを復元し、mainが8pass・skip0を観測した。上記の新候補で非TLS18工程と正式36試行が成功。署名付きCIなど残りの受入れは別途必要。

以下の「最終候補」と呼んだ候補はCI入力修正前の履歴であり、現在sourceの成功証拠ではない。

現在の最終候補：.artifacts/migration-install/candidate-6d64046e-ac07-434b-9489-2f8c57d0e7d1/package.manifest.json。独立consumerは /private/tmp/formicarium-u3-final-consumer-20261015。検証済み：mainの回帰・coverage18工程は全exit0で完了し、.artifacts/migration-install/local-final-20261015/local-regressions.jsonへ記録した。全21JS・1483realm、1768/1929行=91.65%、skip0。source identity=2d449d46138cb20b7cd76b1657ab936febefea1c0c0b81e9b2983704b8e4c096、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2。最終候補の36試行・current CI・短い正式完了確認は未実施である。

CI local準備は `prepare-local ci/migration-install/inputs.bundle.json /private/tmp/formicarium-u3-ci-local-20261015 .artifacts/migration-install/ci-local-prepared-20261015.json` がexit0。root ciディレクトリ不足のENOENTは人間承認後にディレクトリを準備し、同prepareを再実行して成功した。これはローカル準備結果であり、GitHub CI成功・署名Verified・正式受入れの証拠ではない。

以下は文書更新前の試験候補・履歴である。

- 候補：.artifacts/migration-install/candidate-4e9da022-cc47-4c3c-9a0b-2cb774be4046/package.manifest.json
- 独立consumer：/private/tmp/formicarium-u3-sha-consumer-20261015
- 固定guest：.artifacts/u2-release-inputs/aube-v2.7.0/aube

main観測のREADME更新前36試行結果：.artifacts/migration-install/formal36-sha-20261015-v2/measurement-report.json。source identity=e6fded2e29cd8824cc76fcf97abc4ff027aa8a7af879b75416def756234bf654、pack SHA256=d3df71ed7d65e9849616ce87c205e9c0b44762f928b8950b7b79cb79e2f72372。

| 非download中央値(ms) | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| aube | 750.575 | 1723.22 | 723.06 |
| Biome | 988.65 | 2685.16 | 1041.24 |

全6組が≤3000ms。mainは同leaf証明書でmacOS security verify-certとWebKit ignoreHTTPSErrors:falseのTLS確認成功、試行後の証明書削除・未登録確認も観測した。上記は文書変更前候補の成功履歴であり、今回README追加後はsource/packを再固定して36試行を再実行する。

候補のsourceCommitはbase revisionとworking-source inventoryの組合せであり、新規署名済みCI headとは主張しない。このローカル観測だけでacceptancePassed/mergeAllowedや後続単位成功を主張しない。

## Tests Not Yet Executed and Remaining Work

- 現在候補の正式36試行は上記同source/packで成功し、証明書の削除・未登録も確認済み。旧最適化前の未達と旧候補の成功履歴は保持する。
- CI入力修正後候補の全21JS coverageと非TLS回帰18工程・正式36試行は成功済み。current CIと正式完了確認は未完了。
- 署名付きpush・1回のCI：実コマンドの個別承認後に実施。新固定入力prepare/inspect/restoreは成功済み。上記CI prepare-localは修正前の履歴であり、修正後の新候補・CI準備と同一source/pack・GitHub署名Verifiedの独立照合は未実施。
- CI入力のblockerはローカル復元で解消：mainが旧環境で8件中6pass・2skip・exit0を再現し、承認後に10件archive+固定既存guest参照へ修正。実サイト11件のSHA確認と実配信8pass・skip0まで成功した。調査記録は .artifacts/migration-install/ci-site-input-gap-20261015.md。全11件archive案の256MiB超過は履歴として保持し、上限を維持する参照案を採用。プロジェクト側のCI入力問題でありAI-DLC本体の不具合とは判定していない。push/CIは未実施。
- 最終レビュー、新しい短い完了確認コマンドの提示・承認・実行：Step 11の後続作業。README/docs/install-api.mdの作成、個別ignore整合・対象生成JS/CI入力のjj追跡は完了したが、Step 11全体は未完了。

traceability.jsonのOKは現存実装/試験への対応を示す。今回の更新はこの概要と復旧記録のみで、traceabilityの既存GAPは変更していない。ローカルの性能・回帰・coverage証拠は上記まで成功したが、署名付きCI・正式完了確認は引き続き必要。

## Deviations from the Plan

承認済み計画の機能範囲・品質基準に変更なし。全build/testはmain sessionで逐次実行。Step 7の実装・回帰と、改訂Step 8のCI入力・skip拒否・実サイト復元のローカル検証まで進めた。Steps 9–11は未完了。AI-DLC本体、U1/U2の記録、過去のsealed証拠を変更していない。
