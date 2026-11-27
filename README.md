# Tone Bone

**学習コストが低く、見て楽しめる、拡張可能なシンプル DAW ソフト**（Electron + React + TypeScript）

Tone Bone は、直感的なピアノロール打ち込みと静かで美しい再生演出（Stage Mode）、そして **Minecraft のリソースパックのようにテーマや音源を後からフォルダ追加だけで差し替え・重ね合わせできる拡張設計** を備えたデスクトップ DAW です。

---

## 主な特徴

- **直感的なピアノロール＆三連符対応グリッド**
  - 内部解像度 `PPQN = 480` により、通常音符（`1/4`, `1/8`, `1/16`, `1/32`）と三連符（`1/6`, `1/12`, `1/24`）をワンクリックでシームレスに切り替え・混在可能。
  - 最大 **999 小節** まで対応（ビューポート仮想化 Canvas により、長尺曲でも軽快に動作）。
  - 新規ノーツは直前に扱ったノーツの長さを自動引き継ぎ（Synth トラック対象・「設定 → エディタ」でグリッド幅合わせに切替可能）。
  - 範囲選択・まとめ移動・長さ伸縮・コピー＆ペースト・Undo / Redo 対応。
- **複数トラック＆電子音・リズム音源**
  - Web Audio API（`BaseAudioContext` 共通設計）による電子音シンセ＆合成ドラムキット。
  - トラックごとの音色選択、Mute (`M`) / Solo (`S`)、音量バランス、ダブルクリックでのインライン名前変更。
- **Stage Mode（見て楽しめる鑑賞・再生モード）**
  - ワンクリックでウィンドウ全体を使った再生モードに切替。トラック別の流れるノーツ、発音に連動した波紋、リアルタイム波形を描画。
- **ホーム画面（プロジェクト管理）＆自動保存**
  - ワークスペース内（`projects/`）の曲を一覧表示し、ダブルクリック（または `Enter`）で編集画面へ移動、編集画面の「← ホーム」からいつでも戻れます。
  - ホーム画面から新規作成・デモ曲追加・名前変更（JSON 内の曲名とファイル名を同時更新）・複製・削除（OS のゴミ箱へ移動）に対応。
  - デフォルトで**自動保存 ON**（編集後の自動保存＋ホーム帰還時の即時保存）。「設定 → エディタ」から手動保存（離脱時に未保存確認）へ切り替え可能です。
  - 1曲1ファイルのシンプルな `.json` 形式で保存し、`OfflineAudioContext` による **16-bit PCM `.wav` 書き出し** に対応。
  - デフォルトで `~/Documents/ToneBone/`（`projects/`, `exports/`, `themes/`, `sounds/`）を使用。設定画面から任意の場所に変更可能。
- **テーマパック＆音源パック（分離・重ね合わせ設計）**
  - 見た目（`themes/`：`Minimal Light` / `Minimal Dark` 標準同梱）と音源（`sounds/`：`Default Electronic Kit` 標準同梱）を独立管理。テーマを切り替えても曲の音色に影響しません。
  - 設定画面から Apple 風トグルスイッチでの ON/OFF、ドラッグ＆ドロップによる優先順位の並べ替えが可能（ビルド不要・即時反映）。標準ベース音源は常に有効で、追加音源パックを上に重ねられます。

---

## キーボードショートカット

| 操作                                 | macOS                                              | Windows / Linux                                     |
| :----------------------------------- | :------------------------------------------------- | :-------------------------------------------------- |
| 再生 / 一時停止                      | `Space`                                            | `Space`                                             |
| 元に戻す (Undo)                      | `Cmd + Z`                                          | `Ctrl + Z`                                          |
| やり直し (Redo)                      | `Cmd + Shift + Z`                                  | `Ctrl + Shift + Z`                                  |
| 選択ノーツをコピー                   | `Cmd + C`                                          | `Ctrl + C`                                          |
| ペースト（再生位置へ）               | `Cmd + V`                                          | `Ctrl + V`                                          |
| 選択ノーツを削除                     | `Delete` / `Backspace`                             | `Delete` / `Backspace`                              |
| 上書き保存                           | `Cmd + S`                                          | `Ctrl + S`                                          |
| 名前を付けて保存                     | `Cmd + Shift + S`（または `Shift + 保存クリック`） | `Ctrl + Shift + S`（または `Shift + 保存クリック`） |
| 新規プロジェクト作成                 | `Cmd + N`                                          | `Ctrl + N`                                          |
| 選択プロジェクトを開く（ホーム画面） | `Enter`                                            | `Enter`                                             |
| Stage Mode 終了 / 設定を閉じる       | `Esc`                                              | `Esc`                                               |

### ピアノロール操作

- **左クリック**：ノーツ配置（Synth トラックでは右方向の別グリッドへ `8px` 以上ドラッグで長さ調節）
- **ノーツ本体ドラッグ**：移動（複数選択時はまとめて移動）
- **ノーツ右端ドラッグ**：長さ伸縮（Synth トラックのみ）
- **右クリック**：ノーツ削除
- **空白を `Shift + ドラッグ`**（または下部バー「範囲選択」モード）：矩形範囲選択
- **上部の小節ルーラーをクリック**：再生ヘッドを移動
- **左端の鍵盤 / ドラム名をクリック**：音を試聴

---

## ダウンロード & インストール

[GitHub Releases](https://github.com/Yoshiha3/tone-bone/releases) からお使いの OS 向けバイナリをダウンロードできます。

| OS                                    | ファイル                                                                             |
| :------------------------------------ | :----------------------------------------------------------------------------------- |
| macOS (Apple Silicon)                 | `Tone-Bone-<version>-mac-arm64.dmg`                                                  |
| macOS (Intel)                         | `Tone-Bone-<version>-mac-x64.dmg`                                                    |
| Windows (インストーラー / ポータブル) | `Tone-Bone-<version>-win-x64-setup.exe` / `Tone-Bone-<version>-win-x64-portable.exe` |
| Linux (AppImage)                      | `Tone-Bone-<version>-linux-x64.AppImage`                                             |

### 初回起動時の注意（未署名バイナリ）

- **macOS**: Gatekeeper により「開発元が未確認」または「壊れているため開けません」と表示される場合は、`/Applications` にドラッグ＆ドロップした後、ターミナルで以下を実行してから起動してください。

  ```bash
  xattr -cr "/Applications/Tone Bone.app"
  ```
- **Windows**: SmartScreen の警告画面が表示された場合は「詳細情報」→「実行」を選択してください。
- **Linux**: 実行権限を付与して起動してください。

  ```bash
  chmod +x Tone-Bone-*.AppImage
  ./Tone-Bone-*.AppImage
  ```

---

## 開発・テスト・アプリ化

### 必要環境

- Node.js 20 以上（macOS / Windows / Linux 対応）

### セットアップと起動

```bash
npm install
npm run dev
```

### テストと品質チェック

```bash
# TypeScript 厳格型チェック
npm run typecheck

# 単体テスト + 結合テスト (Vitest)
npm run test

# 単体テストのみ / 結合テストのみ
npm run test:unit
npm run test:integration

# 実 Electron アプリ起動 E2E テスト (Playwright)
npm run test:e2e
```

### ネイティブアプリのパッケージング

```bash
# 現在の OS 向けに dist/ へ出力
npm run package

# OS 指定ビルド
npm run package:mac
npm run package:win
npm run package:linux

# build/icon.svg から各 OS 用アイコン (.png / .icns / .ico) を再生成
npm run icons:generate
```

### GitHub Actions による自動ビルド & リリース配布

- **CI（`.github/workflows/ci.yml`）**: `main` への push および PR 時に `typecheck` / `test` / `build` / Electron E2E テストを自動実行します。
- **テスト用バイナリのダウンロード（手動実行）**: GitHub の **Actions → Build & Release → Run workflow** から任意ブランチの macOS / Windows / Linux バイナリをビルドし、Artifacts からダウンロードできます。
- **GitHub Releases への配布（タグ push）**:
  1. `package.json` の `version` を更新してコミット
  2. バージョンに一致するタグを push（例: `git tag v0.1.0 && git push origin v0.1.0`）
  3. 3 OS のバイナリが添付された **Draft Release** が自動作成されるため、内容を確認して Publish します。

> **トラブルシューティング（macOS・Node.js v26 + npm 11 環境）**
> npm 11 のセキュリティ設定や `extract-zip` の挙動により、初回 `npm install` 後に Electron バイナリの展開が不完全になる場合があります。起動時に Electron バイナリのエラーが出る場合は、`~/Library/Caches/electron/` にダウンロードされた zip を `node_modules/electron/dist` へ手動展開（`unzip`）し、`node_modules/electron/path.txt` に `Electron.app/Contents/MacOS/Electron` を書き込むことで解消します。

---

## ワークスペースフォルダ構成

デフォルトの保存先（設定画面「保存先フォルダ」から変更可能）：

```text
~/Documents/ToneBone/
├── projects/   # 曲ファイル (<曲名>.json)
├── exports/    # 書き出した音声ファイル (<曲名>.wav)
├── themes/     # ユーザー自作・追加のテーマパック（見た目・Stage Mode 演出）
└── sounds/     # ユーザー自作・追加の音源パック（シンセ音色定義）
```

---

## ドキュメント

- [docs/architecture.md](docs/architecture.md) — システム設計・責務分離・各モジュールの拡張方法（保存形式・音源・ビジュアライザー）
- [docs/resource-packs.md](docs/resource-packs.md) — リソースパック自作ガイド・CSS デザイントークン一覧・シンセ音色定義
