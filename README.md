# nav-experiment

修士論文実験用のスマートフォン向け歩行ナビゲーション UI プロトタイプです。
HTML / CSS / JavaScript だけで構成された静的サイトなので、Vercel にそのままデプロイできます。

## 実験条件

デプロイ後、以下の URL パラメータで 4 条件を切り替えます。

```text
/?ui=map&condition=normal
/?ui=map&condition=pressure
/?ui=arrow&condition=normal
/?ui=arrow&condition=pressure
```

- `ui=map`: 地図中心型 UI
- `ui=arrow`: 行動指示中心型 UI
- `condition=normal`: 通常条件
- `condition=pressure`: 時間制約条件

例:

```text
https://your-project.vercel.app/?ui=map&condition=normal
https://your-project.vercel.app/?ui=arrow&condition=pressure
```

## Project Structure

```text
nav-experiment/
├── index.html
├── style.css
├── app.js
├── routes.js
├── vercel.json
├── README.md
└── assets/
    ├── map_step_1.png
    ├── map_step_2.png
    ├── map_step_3.png
    ├── turn_step_1.png
    ├── turn_step_2.png
    └── turn_step_3.png
```

## Local Test

VS Code の Live Server などで `index.html` を開いてください。

```text
http://127.0.0.1:5500/index.html?ui=map&condition=normal
http://127.0.0.1:5500/index.html?ui=map&condition=pressure
http://127.0.0.1:5500/index.html?ui=arrow&condition=normal
http://127.0.0.1:5500/index.html?ui=arrow&condition=pressure
```

## Deploy To Vercel

### Option 1: Vercel Dashboard

1. この `nav-experiment` フォルダを GitHub などの Git リポジトリに push します。
2. [Vercel](https://vercel.com/) で `Add New...` → `Project` を選択します。
3. リポジトリを import します。
4. Project Root がリポジトリ直下ではなく親フォルダの場合は、Root Directory を `nav-experiment` に設定します。
5. Framework Preset は `Other` を選択します。
6. Build Command は空欄のままで構いません。
7. Output Directory も空欄、または `.` にします。
8. Deploy を実行します。

### Option 2: Vercel CLI

```bash
cd nav-experiment
vercel
vercel --prod
```

初回実行時に設定を聞かれた場合:

- Framework: `Other`
- Build Command: 空欄
- Output Directory: `.`

## Geolocation Notes

この実験プロトタイプは `navigator.geolocation.watchPosition` を使用します。
Geolocation API は通常 HTTPS の secure context が必要です。

Vercel の本番 URL は標準で HTTPS になるため、スマートフォンのブラウザでも位置情報 API を利用できます。
ただし、端末側で位置情報の利用許可が必要です。

## Route Editing

ルート座標、地図画像、簡易地図画像は `routes.js` で編集します。

- `mapImage`: 地図中心型 UI の大きな地図画像
- `simpleMapImage`: 行動指示中心型 UI の小型簡易地図画像
- `target.lat` / `target.lng`: 自動ステップ切り替え判定用の目標座標
- `triggerRadius`: 目標座標に到達したと判定する半径

`simpleMapImage` が未設定の場合、アプリは自動的に `mapImage` を使用します。
