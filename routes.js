/*
 * Route definition file for the navigation experiment.
 *
 * Replace only this file when you change the walking route:
 * 1. Put static map screenshots in assets/ and update mapImage.
 * 2. Put simplified turn-by-turn map screenshots in assets/ and update
 *    simpleMapImage. If omitted, app.js falls back to mapImage.
 * 3. Replace path coordinates with the real route segment coordinates.
 * 4. Replace target.lat / target.lng with the real maneuver / arrival point.
 * 5. Tune triggerRadius after field testing.
 *
 * Turn-by-turn logic:
 * - path is the route segment for the current instruction.
 * - decisionPoint is the corner where the participant should turn.
 * - confirmationPoint is a point after the turn on the correct road.
 * - target is kept for backward compatibility and points to confirmationPoint.
 * - triggerRadius is the arrival radius around confirmationPoint.
 * - preview is shown before the participant reaches the decisionPoint.
 * - actionDisplay is shown when distanceToDecisionPoint < actionDistance.
 * - confirmingDisplay is shown after entering decisionRadius.
 * - UI distance is calculated from live GPS, so remainingDistance is not
 *   hard-coded in the steps.
 * - A slight bend in a road does not require a new Step. Create a new
 *   decisionPoint only when the participant must actively choose a direction
 *   at an intersection or corner.
 * - If path is omitted, app.js falls back to the old target-radius behavior.
 */

// Centralized route tuning values. Adjust these after on-site pilot testing.
const ROUTE_TUNING = Object.freeze({
  turnStep: {
    actionDistance: 30,
    decisionRadius: 15,
    triggerRadius: 20,
  },
  destinationStep: {
    triggerRadius: 20,
  },
});

const pilotRoutePoints = {
  start: {
    label: "やましろ接骨院・鍼灸院",
    lat: 35.86055,
    lng: 139.613314,
  },
  turn1: {
    label: "第1拐点",
    lat: 35.860399,
    lng: 139.614245,
  },
  confirmation1: {
    label: "第1確認点",
    lat: 35.860228,
    lng: 139.614314,
  },
  turn2: {
    label: "第2拐点",
    lat: 35.859557,
    lng: 139.614583,
  },
  confirmation2: {
    label: "第2確認点",
    lat: 35.859491,
    lng: 139.614377,
  },
  turn3: {
    label: "第3拐点",
    lat: 35.859148,
    lng: 139.61331,
  },
  confirmation3: {
    label: "第3確認点",
    lat: 35.858988,
    lng: 139.613412,
  },
  destination: {
    label: "バス停",
    lat: 35.857851,
    lng: 139.614143,
  },
};

window.routeMeta = {
  routeId: "pilot-route-yamashiro-busstop",
  routeName: "やましろ接骨院・鍼灸院からバス停まで",
  navigationMode: "turn-by-turn",
  destinationName: "バス停",
  start: pilotRoutePoints.start,
  waypoints: [
    pilotRoutePoints.turn1,
    pilotRoutePoints.confirmation1,
    pilotRoutePoints.turn2,
    pilotRoutePoints.confirmation2,
    pilotRoutePoints.turn3,
    pilotRoutePoints.confirmation3,
    pilotRoutePoints.destination,
  ],
  // Outdoor GPS can drift near buildings. Tune this value after pilot testing.
  offRouteThreshold: 35,
  actionDistance: ROUTE_TUNING.turnStep.actionDistance,
  decisionRadius: ROUTE_TUNING.turnStep.decisionRadius,
  routeTuning: ROUTE_TUNING,
};

window.routeSteps = [
  {
    id: "step-1",
    title: "Step 1",
    mapImage: "./assets/map_step_1.png",
    simpleMapImage: "./assets/turn_step_1.png",
    action: "turn-right",
    arrow: "↱",
    task: "从起点直行到第1拐点，并在第1拐点右转",
    preview: {
      mainText: "この先を右折",
      subText: "前方の曲がり角を右折してください",
    },
    actionDisplay: {
      mainText: "右折してください",
      subText: "この曲がり角を右方向へ進んでください",
    },
    confirmingDisplay: {
      mainText: "右折してください",
      subText: "この曲がり角を右方向へ進んでください",
    },
    mainText: "この先を右折",
    subText: "前方の曲がり角を右折してください",
    advanceType: "maneuver",
    ...ROUTE_TUNING.turnStep,
    decisionPoint: pilotRoutePoints.turn1,
    confirmationPoint: pilotRoutePoints.confirmation1,
    path: [pilotRoutePoints.start, pilotRoutePoints.turn1, pilotRoutePoints.confirmation1],
    target: pilotRoutePoints.confirmation1,
  },
  {
    id: "step-2",
    title: "Step 2",
    mapImage: "./assets/map_step_2.png",
    simpleMapImage: "./assets/turn_step_2.png",
    action: "turn-right",
    arrow: "↱",
    task: "沿道路前进，在第2拐点右转",
    preview: {
      mainText: "この先を右折",
      subText: "前方の交差点を右折してください",
    },
    actionDisplay: {
      mainText: "右折してください",
      subText: "この交差点を右方向へ進んでください",
    },
    confirmingDisplay: {
      mainText: "右折してください",
      subText: "この交差点を右方向へ進んでください",
    },
    mainText: "この先を右折",
    subText: "前方の交差点を右折してください",
    advanceType: "maneuver",
    ...ROUTE_TUNING.turnStep,
    decisionPoint: pilotRoutePoints.turn2,
    confirmationPoint: pilotRoutePoints.confirmation2,
    path: [pilotRoutePoints.confirmation1, pilotRoutePoints.turn2, pilotRoutePoints.confirmation2],
    target: pilotRoutePoints.confirmation2,
  },
  {
    id: "step-3",
    title: "Step 3",
    mapImage: "./assets/map_step_3.png",
    simpleMapImage: "./assets/turn_step_3.png",
    action: "turn-left",
    arrow: "↰",
    task: "沿道路前进，在第3拐点左转",
    preview: {
      mainText: "この先を左折",
      subText: "前方の曲がり角を左折してください",
    },
    actionDisplay: {
      mainText: "左折してください",
      subText: "この曲がり角を左方向へ進んでください",
    },
    confirmingDisplay: {
      mainText: "左折してください",
      subText: "この曲がり角を左方向へ進んでください",
    },
    mainText: "この先を左折",
    subText: "前方の曲がり角を左折してください",
    advanceType: "maneuver",
    ...ROUTE_TUNING.turnStep,
    decisionPoint: pilotRoutePoints.turn3,
    confirmationPoint: pilotRoutePoints.confirmation3,
    path: [pilotRoutePoints.confirmation2, pilotRoutePoints.turn3, pilotRoutePoints.confirmation3],
    target: pilotRoutePoints.confirmation3,
  },
  {
    id: "step-4",
    title: "Step 4",
    // Replace these placeholder files with route-specific Step 4 screenshots
    // after preparing the final experiment maps.
    // This last road segment bends slightly while generally heading south.
    // Treat it as one "道なりに進む" Step; do not add a decisionPoint for
    // the road's gentle curvature unless a real directional choice appears.
    mapImage: "./assets/map_step_4.png",
    simpleMapImage: "./assets/turn_step_4.png",
    action: "arrive",
    arrow: "↑",
    task: "沿最后一段道路直行至巴士站",
    preview: {
      mainText: "そのまま直進",
      subText: "この道路を道なりに進んでください",
    },
    actionDisplay: {
      mainText: "まもなく到着します",
      subText: "前方のバス停が目的地です",
    },
    confirmingDisplay: {
      mainText: "まもなく到着します",
      subText: "前方のバス停が目的地です",
    },
    arrivedDisplay: {
      mainText: "目的地に到着しました",
    },
    mainText: "そのまま直進",
    subText: "この道路を道なりに進んでください",
    advanceType: "arrival",
    ...ROUTE_TUNING.destinationStep,
    decisionPoint: pilotRoutePoints.destination,
    confirmationPoint: pilotRoutePoints.destination,
    path: [pilotRoutePoints.confirmation3, pilotRoutePoints.destination],
    target: pilotRoutePoints.destination,
  },
];
