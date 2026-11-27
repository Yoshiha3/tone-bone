# テーマパック＆音源パック作成ガイド

Tone Bone は **見た目（テーマパック）** と **音色（音源パック）** を独立したフォルダで管理し、**フォルダを追加するだけで差し替え・重ね合わせ** できるリソースパック方式を採用しています。

- 標準同梱パック（`Minimal Light` / `Minimal Dark` / `Default Electronic Kit`）はアプリ本体側に格納されており、ユーザー用フォルダ（`themes/`・`sounds/`）には表示されません（初期状態では空です）。
- テーマを切り替えても音源には影響せず、標準ベース音源（`default-sounds`）は常に最下層で有効なため、曲の音色が欠損する心配がありません。

---

## 配置場所と適用方法

1. アプリ内の **「設定 → テーマ → テーマフォルダを開く」**（デフォルト：`~/Documents/ToneBone/themes/`）または **「設定 → 音源パック → 音源フォルダを開く」**（デフォルト：`~/Documents/ToneBone/sounds/`）をクリックします。
2. その中に好きな名前のフォルダを作成し、必要なファイルを配置します。
3. アプリに戻り **「再読み込み」** をクリックして、トグルスイッチを ON にします。

### 優先順位（重ね合わせルール）

- 各タブの **「有効なパック（上が優先）」** リストで、**上にあるパックほど優先して下位のパックを部分上書き** します。
- ドラッグ＆ドロップでいつでも優先順を並べ替えられます（音源パックの標準ベース `Default Electronic Kit` は常に最下層に固定されます）。
- 変更したいファイルやトークンだけを書けば、未指定の項目は下位のパックや既定値がそのまま引き継がれます。
- 標準同梱パック（例：`minimal-light`, `default-sounds`）と同じ `id` を持つユーザーパックを配置すると、同梱パックの定義そのものを置き換えることもできます（ユーザー側を削除すれば元に戻ります）。

---

## テーマパックの構成（`themes/`）

必須なのは `pack.json` のみです。その他はカスタマイズしたいものだけ配置してください。

```text
themes/my-pastel-theme/
├── pack.json         # 【必須】パックのメタデータ
├── tokens.json       # 【任意】CSS デザイントークンの上書き
├── override.css      # 【任意】自由な追加・上書き CSS
└── visualizer.json   # 【任意】Stage Mode の演出設定
```

> 後方互換のため、`theme/tokens.json`・`theme/override.css`・`visualizer/preset.json` の配置も読み込み可能です。

### 1. `pack.json`（必須）

```json
{
  "id": "my-pastel-theme",
  "name": "My Pastel",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Soft pastel colors for calm composing."
}
```

> 読み込み時に必須検証されるのは `id` と `name`（いずれも文字列）のみですが、`description` は設定画面の一覧に表示されるため、上記5項目すべてを記述することを推奨します。

### 2. `tokens.json`（任意・部分上書き可能）

| トークン名                                                          | 用途                                           |
| :------------------------------------------------------------------ | :--------------------------------------------- |
| `--bg-app`                                                          | アプリ全体の背景色                             |
| `--bg-surface`                                                      | ヘッダー・サイドバー・モーダル等のパネル背景色 |
| `--bg-surface-alt`                                                  | 選択カードや入力ボックス等の補助背景色         |
| `--bg-hover`                                                        | ボタンホバー時の背景色                         |
| `--border-subtle` / `--border-strong`                               | 枠線（弱 / 強）                                |
| `--text-primary` / `--text-secondary` / `--text-muted`              | 文字色（主 / 副 / 控えめ）                     |
| `--accent-primary` / `--accent-primary-hover` / `--accent-contrast` | アクセントカラーと上に載る文字色               |
| `--danger` / `--solo-active` / `--mute-active`                      | 削除・Solo・Mute の状態色                      |
| `--grid-bg` / `--grid-row-alt`                                      | ピアノロールの白鍵行 / 黒鍵行の背景色          |
| `--grid-line-bar` / `--grid-line-beat` / `--grid-line-sub`          | 小節線 / 拍線 / 細分化グリッド線               |
| `--playhead`                                                        | 再生ヘッドの色                                 |
| `--selection-fill` / `--selection-border`                           | 範囲選択ボックスの塗り・枠線                   |
| `--track-color-0` 〜 `--track-color-5`                              | トラック別カラーパレット（6色）                |
| `--radius-sm` / `--radius-md`                                       | 角丸サイズ                                     |
| `--font-ui` / `--font-mono`                                         | UI フォント / 等幅フォント                     |

例（アクセント色だけ差し替える最小テーマパック）：

```json
{
  "--accent-primary": "#2f8f7b",
  "--accent-primary-hover": "#257564",
  "--playhead": "#2f8f7b"
}
```

### 3. `visualizer.json`（任意・部分上書き可能）

```json
{
  "rendererId": "minimal-flow",
  "background": "#f6f7f9",
  "waveColor": "#3b6ea5",
  "gridColor": "#e2e6ed",
  "noteOpacity": 0.9,
  "rippleScale": 1.0,
  "showWaveform": true
}
```

---

## 音源パックの構成（`sounds/`）

```text
sounds/my-chiptune-sounds/
├── pack.json         # 【必須】パックのメタデータ
└── instruments.json  # 【任意】追加・上書きするシンセ音色定義
```

> 後方互換のため、`sounds/instruments.json` の配置も読み込み可能です。

### `instruments.json`

同じ `id` を書くと標準音色（または下位パックの音色）を上書きし、新しい `id` を書くと音色リストに追加されます。

```json
[
  {
    "id": "retro-lead",
    "name": "Retro Lead",
    "type": "synth",
    "synth": {
      "waveform": "square",
      "attack": 0.005,
      "decay": 0.12,
      "sustain": 0.4,
      "release": 0.12,
      "filterCutoff": 2400,
      "detuneCents": 3,
      "gainScale": 0.55
    }
  }
]
```

- `waveform`: `"sine"` | `"square"` | `"sawtooth"` | `"triangle"`
- `attack`, `decay`, `release`: 秒数（例: `0.01`）
- `sustain`: `0.0` 〜 `1.0`
- `filterCutoff`: ローパスフィルタのカットオフ周波数（Hz・省略可）
- `detuneCents`: デチューン量（セント・省略可）
- `gainScale`: 音量補正係数（省略時 `0.8`）
