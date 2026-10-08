# U2 試験指示

## Runnerと設定
既存node:test、Playwright、strict TypeScriptを使用する。mise実体のNodeを解決し、宣言taskはmise run。新しいtests/migration-session/playwright.config.tsはChromium/Firefox/WebKit、workers=1、retries=0、既存COI静的serverと同じWorker環境を使う。試験ファイルはTypeScriptから既存buildでJS生成する。

## 単位内コマンド
準備（mainのみ）：mise run build、mise run typecheck。runner確認は解決したNode実体で node --test --test-concurrency=1 tests/package/runner-ready.test.js。
U2 unit taskの正確な内容：
```text
node --test --test-concurrency=1 tests/migration-session/guest-validation.test.js tests/migration-session/fixture.test.js tests/migration-session/reservation.test.js tests/migration-session/public.test.js tests/migration-session/consumer.test.js
```
宣言taskを整えた後は mise run migration-session-unit。
U2 browser taskの正確な内容：
```text
node node_modules/@playwright/test/cli.js test --config tests/migration-session/playwright.config.ts tests/migration-session/consumer.spec.ts
```
宣言taskを整えた後は mise run migration-session-browser。
段階3ではguest-validation.test.jsとfixture.test.js、段階5ではreservation.test.js、段階7ではpublic.test.jsとconsumer.test.jsの正確なfile subsetを同じnode:test runnerで実行する。いずれもbare全体npm testを使わない。

## ケースとデータ
各論理部品5–8件以上を下限とし、契約の境界件数を省かない。SHA vector・合成ELF header/segment、合法/不正metadata、上限/+1、Unicode/path/symlink/hardlink fixtureを使う。reservationは制御spawn/cleanupで遅延競合を再現しsleep依存を避ける。pack consumerは実guest/wasmと新候補を使用し、mockだけで実実行成功を主張しない。型fixtureは同unit types-valid/types-invalidを専用tsconfigで検査する。

## 品質と完了証拠
第一者配布JS固定inventory全ファイル、全realmを集約しline coverage≥80%。既存回帰はU2 completion側で1回ずつ逐次実行し、Unit test指示へ全体suiteのbare commandを混ぜない。timeout 600秒probe/840秒browser aube、probe8、native一致、wasm1GB、1worker/retry0を維持する。
同一source/pack/inventoryのU2暫定証拠を保存する。旧16JS/26pack・署名付きCIは履歴として保持し、現在21JS/31packのCI成功とは扱わない。U3 installは既存コードがあるが正式受入れ未完了、U4 commandは今後の作業として区別する。B1完全受入れへ昇格しない。実機Safari、現在sourceの未実施CIは未検証と記載する。

## 今回の再開で行う確認
v5固定入力SHA256 54b5da8fa4052a6894eab0cc63ee02556252b253d17f6ab8404f1aa5f5afc3bd、結果SHA256 12d6bd4a509ebf374f052067959595d86f5e8c4c24035ef9bea4597e24275ff2を照合する。2026-10-15T11:06:12.240Z–12:11:43.979Zの既存21工程exit0、U2/U3計測付きNode115件・U2の3ブラウザ9件、全配布21JSの1768/1929行（91.65%）、skipなしを原ログと対応づける。これは既に実行した結果の照合であり、本再開での新規実行とは記載しない。旧v4は履歴として保持する。
正式完了確認はレコード直下verification-command.txtに設定済みの、承認済みcurrent-completion.js verifyをmainで実行する。固定入力・結果のハッシュ、現在source、全realm raw coverage、封印証拠の一致を要求する。コマンドを変更せず、全21工程を自動再実行しない。不一致・失敗・コード修正の必要が生じたら停止し、修正案と必要な再検証を確認する。U3性能改善・36試行・専用CIは今回の確認に含めない。
