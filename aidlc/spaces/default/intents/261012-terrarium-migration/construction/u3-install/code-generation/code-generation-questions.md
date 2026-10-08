# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and tell me in chat when you are done.

## Plan Approval

Approve the code plan for u3-install?

- Builds: 実配信入力を復元し、必須試験のskipを拒否するU3 CI・受入入口の修正。
- Touches: scripts/migration-installのCI入力・実行・完了確認、専用workflow、acceptance試験、固定CI入力と実装記録。
- Tests: 入力欠落・改変・不正パス・容量超過とexit0のskipを拒否し、実配信8試験skip0、新候補の回帰・coverage80%以上・正式36試行・署名付き同一候補CIを確認する。
- Already changed before you approved (20 files): .artifacts/migration-install/actual-site.tar.gz, .build/scripts/migration-install/ci-inputs.js, .build/scripts/migration-install/ci-inputs.js.map, .build/scripts/migration-install/ci.js, .build/scripts/migration-install/ci.js.map, .build/scripts/migration-install/completion.js, .build/scripts/migration-install/completion.js.map, .build/tests/migration-install/acceptance.test.js, .build/tests/migration-install/acceptance.test.js.map, .github/workflows/migration-install-u3.yml (and 10 more).

Full plan: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u3-install/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:b598cbdb5bd5581225b085d50102094281bf616ed931cd65c2ab29e3486a780d
[Planned Source]: 4c700a870b6fba417c03fbc32512cdb97d1d9c86b1e1085fa527d4e6983590e8

- A. Approve Plan
- B. Request Changes
- C. I'll edit the files

[Answer]: A. Approve Plan
