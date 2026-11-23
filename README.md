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
  - デフォルトで `~/Documents/ToneBone/`（`projects/`, `exports/`, `packs/`）を使用。設定画面から任意の場所に変更可能。
- **Minecraft 風リソースパック**
  - `Minimal Light` / `Minimal Dark` の2種を標準同梱。
  - 設定画面から Apple 風トグルスイッチでの ON/OFF、ドラッグ＆ドロップによる優先順位の並べ替えが可能（ビルド不要・即時反映）。

---

## キーボードショートカット

| 操作 | macOS | Windows / Linux |
| :--- | :--- | :--- |
| 再生 / 一時停止 | `Space` | `Space` |
| 元に戻す (Undo) | `Cmd + Z` | `Ctrl + Z` |
| やり直し (Redo) | `Cmd + Shift + Z` | `Ctrl + Shift + Z` |
| 選択ノーツをコピー | `Cmd + C` | `Ctrl + C` |
| ペースト（再生位置へ） | `Cmd + V` | `Ctrl + V` |
| 選択ノーツを削除 | `Delete` / `Backspace` | `Delete` / `Backspace` |
| 上書き保存 | `Cmd + S` | `Ctrl + S` |
| 名前を付けて保存 | `Cmd + Shift + S`（または `Shift + 保存クリック`） | `Ctrl + Shift + S`（または `Shift + 保存クリック`） |
| 新規プロジェクト作成 | `Cmd + N` | `Ctrl + N` |
| 選択プロジェクトを開く（ホーム画面） | `Enter` | `Enter` |
| Stage Mode 終了 / 設定を閉じる | `Esc` | `Esc` |

### ピアノロール操作
- **左クリック**：ノーツ配置（Synth トラックでは右方向の別グリッドへ `8px` 以上ドラッグで長さ調節）
- **ノーツ本体ドラッグ**：移動（複数選択時はまとめて移動）
- **ノーツ右端ドラッグ**：長さ伸縮（Synth トラックのみ）
- **右クリック**：ノーツ削除
- **空白を `Shift + ドラッグ`**（または下部バー「範囲選択」モード）：矩形範囲選択
- **上部の小節ルーラーをクリック**：再生ヘッドを移動
- **左端の鍵盤 / ドラム名をクリック**：音を試聴

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
# macOS (.app / .dmg), Windows (.exe), Linux (.AppImage) を dist/ へ出力
npm run package
```

> **トラブルシューティング（macOS・Node.js v26 + npm 11 環境）**
> npm 11 のセキュリティ設定や `extract-zip` の挙動により、初回 `npm install` 後に Electron バイナリの展開が不完全になる場合があります。起動時に Electron バイナリのエラーが出る場合は、`~/Library/Caches/electron/` にダウンロードされた zip を `node_modules/electron/dist` へ手動展開（`unzip`）し、`node_modules/electron/path.txt` に `Electron.app/Contents/MacOS/Electron` を書き込むことで解消します。

---

## ワークスペースフォルダ構成

デフォルトの保存先（設定画面「保存先フォルダ」から変更可能）：

```text
~/Documents/ToneBone/
├── projects/   # 曲ファイル (<曲名>.json)
├── exports/    # 書き出した音声ファイル (<曲名>.wav)
└── packs/      # ユーザー自作・追加のリソースパック
```

---

## ドキュメント

- [docs/architecture.md](docs/architecture.md) — システム設計・責務分離・各モジュールの拡張方法（保存形式・音源・ビジュアライザー）
- [docs/resource-packs.md](docs/resource-packs.md) — リソースパック自作ガイド・CSS デザイントークン一覧・シンセ音色定義
