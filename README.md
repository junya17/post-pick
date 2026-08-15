# 選別 — どれを出すか決める

同じ撮影から持ち帰った候補を2〜6枚並べると、投稿する一枚を選ぶ。
作品としての出来ではなく、その媒体のタイムラインで機能するかで選ぶ。

写真1枚の質を採点するほうは別アプリ（photo-score）。問いが違うので分けてある。

## 構成

```
.
├── index.html
├── functions/
│   └── api/
│       └── pick.js        Cloudflare Pages Function
└── README.md
```

`functions/api/pick.js` がそのまま `/api/pick` になる。ディレクトリ名は変えないこと。

## デプロイ

```bash
npx wrangler pages deploy . --project-name post-pick
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name post-pick
npx wrangler pages secret put PASSCODE          --project-name post-pick
```

Secret を入れたあとは、もう一度 deploy するか Retry deployment を押す。

GitHub 連携にする場合は、ビルドコマンド空欄・出力ディレクトリ `/`。
photo-score とは別リポジトリ・別プロジェクトにする。

## ローカル

```bash
npx wrangler pages dev .
```

`.dev.vars` に `ANTHROPIC_API_KEY=sk-ant-...`（`.gitignore` 済み）。

## 調整するところ

`functions/api/pick.js` の中。

| 場所 | 何を変えるか |
|---|---|
| `SYSTEM` の【選ぶときの判断材料】 | 何を見て選ぶか。使っている媒体の実感に合わせる |
| `SYSTEM` の【守ること】 | 出力の態度。トリミングの既定は縦4:5 |
| `MAX_IMAGES` | 候補の上限（既定6） |
| `MODEL` | `claude-sonnet-5` / `claude-opus-5` |

出す先の選択肢は `index.html` の `<select id="venue">` にある。

## 動きの前提

- 画像は長辺1200pxに縮小してから送る。6枚で1回あたり1万トークン前後
- 番号がずれないよう、各画像の直前に「N枚目」というテキストを入れて渡している
- reach は推定であって予測ではない。実際の反応は投稿時間・フォロワー構成・キャプションで大きく変わる
- 出す先を変えると順位は入れ替わる。それが正常
