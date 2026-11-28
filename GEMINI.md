# Onkai 開発ルール

このリポジトリで作業する際は、以下のルールに従ってください。

---

## 1. ブランチ運用

- 機能追加・バグ修正・リファクタリング・ドキュメント更新などの作業は、必ず `main` から作業用ブランチを切って行うこと。
  - ブランチ名の例: `feat/piano-roll-zoom`, `fix/stage-grid-reset`, `refactor/track-list`, `docs/dev-rules`
- `main` ブランチへ直接コミットしないこと。

---

## 2. コミット方針

- コミットは機能・関心事ごとに小さく分割し、後から `git log` を読み返しただけで意図と変更履歴が追える粒度にすること。
- 原則として、各コミット単体でビルド・型チェック・テストが壊れない状態を保つこと。
- コミットメッセージは既存の履歴に合わせて **Conventional Commits** 形式（`<type>(<scope>): <concise English summary>`）で記述すること。
  - 主な `type`: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
  - 例:
    - `feat(pianoRoll): support trackpad pinch zoom with pointer-anchored scroll`
    - `fix(pianoRoll,store): preserve grid zoom, tool mode, and scroll across Stage Mode`
    - `refactor(ui): extract declarative keyboard shortcuts`
    - `test(core,store): add group-safe note move and track reorder tests`

---

## 3. 設計・実装の見直し（変更最小化の原則）

- 将来の機能追加・仕様変更時に **コードの変更箇所が最小限で済む設計** を心がけること。
  - 既存アーキテクチャ（[docs/architecture.md](docs/architecture.md)）の原則である「外側の UI・Electron ほど薄く、内側の純粋ドメインほど依存ゼロ」を守る。
  - 定数・仕様・ショートカット・ツール定義などは散在させず、Single Source of Truth（`TRACK_TYPE_SPECS`・`SHORTCUT_BINDINGS`・レジストリ等）に集約する。
  - 計算・状態遷移などのロジックは純粋関数として切り出し、単体テストしやすくする。
- **実装前・実装中に必ず設計を見直すこと**:
  - 「この実装で本当に良いか？」
  - 「同じような変更や機能追加が来たとき、1〜数箇所の修正で済むか？」
  - 「ハードコードや重複ロジックを増やしていないか？」
- 変更後は `npm run typecheck` および `npm test`（必要に応じて `npm run build`）を実行し、既存機能を壊していないことを確認すること。
