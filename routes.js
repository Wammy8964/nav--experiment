/*
 * Route definition file for the navigation experiment.
 *
 * Replace only this file when you change the walking route:
 * 1. Put static map screenshots in assets/ and update mapImage.
 * 2. Put simplified turn-by-turn map screenshots in assets/ and update
 *    simpleMapImage. If omitted, app.js falls back to mapImage.
 * 3. Replace target.lat / target.lng with the real waypoint coordinates.
 * 4. Tune triggerRadius for each waypoint after field testing.
 *
 * Each step's target is the point that triggers the transition to the next
 * instruction. The final step's target triggers experiment_finish.
 */
window.routeMeta = {
  destinationName: "目的地",
};

window.routeSteps = [
  {
    id: "step-1",
    title: "Step 1",
    mapImage: "./assets/map_step_1.png",
    simpleMapImage: "./assets/turn_step_1.png",
    arrow: "↑",
    mainText: "まっすぐ進む",
    subText: "正面の通路を直進してください。",
    remainingDistance: "約 240 m",
    target: {
      lat: 35.86034350734907, 
      lng: 139.61338311592976,
    },
    triggerRadius: 18,
  },
  {
    id: "step-2",
    title: "Step 2",
    mapImage: "./assets/map_step_2.png",
    simpleMapImage: "./assets/turn_step_2.png",
    arrow: "↱",
    mainText: "右方向へ進む",
    subText: "交差点の手前で右方向の道へ進んでください。",
    remainingDistance: "約 150 m",
    target: {
      lat: 35.873935508210984, 
      lng: 139.62424602578804,
    },
    triggerRadius: 18,
  },
  {
    id: "step-3",
    title: "Step 3",
    mapImage: "./assets/map_step_3.png",
    simpleMapImage: "./assets/turn_step_3.png",
    arrow: "↰",
    mainText: "左方向へ進む",
    subText: "目的地入口に向かって左方向へ進んでください。",
    remainingDistance: "約 60 m",
    target: {
      lat: 35.872282258597565, 
      lng: 139.76772,
    },
    triggerRadius: 139.64575961597745,
  },
];
