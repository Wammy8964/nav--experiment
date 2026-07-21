# nav-experiment

修士論文実験用のスマートフォン向け歩行ナビゲーション UI プロトタイプです。
HTML / CSS / JavaScript だけで構成された静的サイトなので、Vercel にそのままデプロイできます。

## Current Route

- routeId: `pilot-route-yamashiro-busstop`
- routeName: `やましろ接骨院・鍼灸院からバス停まで`
- navigationMode: `turn-by-turn`
- Step count: 4

各 Step は `preview` / `action` / `confirming` の phase を持ちます。
Step 完了は `decisionPoint` ではなく、正しい進行方向上の `confirmationPoint` で判定します。

第3拐点から终点までの最后の道路は、整体として南方向へ進みますが、実際の道路は少し弯曲しています。
現阶段ではこの軽微な弯曲を新しい Step にはせず、1 つの `道なりに進む` Step として扱います。
新しい `decisionPoint` は、参加者が交差点や曲がり角で能動的に方向を選ぶ必要がある場合にだけ追加します。

## Experiment URLs

正式 GPS モード:

```text
/?route=pilot-route-yamashiro-busstop&ui=map&condition=normal
/?route=pilot-route-yamashiro-busstop&ui=map&condition=pressure
/?route=pilot-route-yamashiro-busstop&ui=action&condition=normal
/?route=pilot-route-yamashiro-busstop&ui=action&condition=pressure
```

- `ui=map`: 地図中心型 UI
- `ui=action`: 行動指示中心型 UI
- `ui=arrow`: `ui=action` と同じ互換 alias
- `condition=normal`: 通常条件
- `condition=pressure`: 時間制約条件

Debug モード:

```text
/?route=pilot-route-yamashiro-busstop&ui=action&condition=normal&debug=true
```

Mock GPS モード:

```text
/?route=pilot-route-yamashiro-busstop&ui=action&condition=normal&debug=true&mockGps=true
```

`mockGps=true` は室内確認用です。実 GPS 権限を要求せず、debug panel の mock GPS ボタンから同じ GPS 状態機へ位置を入力します。

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
    ├── map_step_4.png
    ├── turn_step_1.png
    ├── turn_step_2.png
    ├── turn_step_3.png
    └── turn_step_4.png
```

## Route Editing

ルート座標、地図画像、簡易地図画像、判定半径は `routes.js` で編集します。

- `ROUTE_TUNING.turnStep.actionDistance`: preview から action に変わる距離
- `ROUTE_TUNING.turnStep.decisionRadius`: decisionPoint 到達判定用の半径
- `ROUTE_TUNING.turnStep.triggerRadius`: confirmationPoint 到達判定用の半径
- `ROUTE_TUNING.destinationStep.triggerRadius`: 終点到達判定用の半径
- `pilotRoutePoints`: 起点、拐点、確認点、終点の座標
- `decisionPoint`: 曲がるべき地点
- `confirmationPoint`: 曲がった後の正しい道路上の確認点
- `mapImage`: 地図中心型 UI の大きな地図画像
- `simpleMapImage`: 行動指示中心型 UI の小型簡易地図画像
- `path`: 現在 Step の経路片

道路線が少し曲がっているだけの場合は、`path` に必要な座標を追加して経路片の形状を表現します。
その軽微な弯曲だけを理由に Step や `decisionPoint` を増やさないでください。

判定ロジック全体の共通設定は `app.js` の `EXPERIMENT_CONFIG` にあります。

- `MAX_ACCEPTABLE_ACCURACY`
- `REQUIRED_CONFIRMATION_HITS`
- `STEP_COOLDOWN_MS`

## Logs

JSON には `meta`, `routeMeta`, `routeSteps`, `logs` が含まれます。
主なイベント:

- `experiment_start`
- `navigation_started`
- `gps`
- `phase_changed`
- `decision_point_entered`
- `confirmation_point_hit`
- `confirmation_rejected_accuracy`
- `step_completed`
- `step_change`
- `arrived`
- `navigation_finished`
- `experiment_finish`
- `manual_next`
- `manual_previous`

## Local Test

VS Code Live Server などで `index.html` を開いてください。

```text
http://127.0.0.1:5500/index.html?route=pilot-route-yamashiro-busstop&ui=action&condition=normal&debug=true&mockGps=true
```

Geolocation API は HTTPS または localhost / 127.0.0.1 の secure context で動作します。

## Deploy To Vercel

### Vercel Dashboard

1. この `nav-experiment` フォルダを GitHub などの Git リポジトリに push します。
2. Vercel で `Add New...` -> `Project` を選択します。
3. リポジトリを import します。
4. Root Directory が必要な場合は `nav-experiment` に設定します。
5. Framework Preset は `Other` を選択します。
6. Build Command は空欄のままで構いません。
7. Output Directory も空欄、または `.` にします。
8. Deploy を実行します。

### Vercel CLI

```bash
cd nav-experiment
vercel
vercel --prod
```

Vercel の本番 URL は HTTPS になるため、スマートフォンのブラウザでも Geolocation API を利用できます。
