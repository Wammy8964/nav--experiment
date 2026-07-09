const routeSteps = Array.isArray(window.routeSteps) ? window.routeSteps : [];
const routeMeta = window.routeMeta || {};

// The pressure limit is stored for the experiment log only.
// The participant-facing navigation screen never shows a countdown.
const PRESSURE_LIMIT_SECONDS = 300;
const REQUIRED_ACCURACY_METERS = 35;
const REQUIRED_CONSECUTIVE_HITS = 2;
const STEP_COOLDOWN_MS = 10_000;
const PANEL_TAP_COUNT = 5;
const PANEL_TAP_WINDOW_MS = 1500;
const PANEL_LONG_PRESS_MS = 700;

const params = new URLSearchParams(window.location.search);
const uiType = normalizeUIType(params.get("ui"));
const condition = normalizeCondition(params.get("condition"));

const state = {
  screen: "start",
  currentStepIndex: 0,
  watchId: null,
  started: false,
  arrived: false,
  finished: false,
  startedAt: null,
  arrivedAt: null,
  finishedAt: null,
  insideHitCount: 0,
  lastStepChangeAt: 0,
  locationStatus: "開始前",
  panelOpen: false,
  titleTapCount: 0,
  titleTapTimer: null,
  titleLongPressTimer: null,
  latestPosition: {
    lat: null,
    lng: null,
    accuracy: null,
    distanceToTarget: null,
  },
  logs: [],
};

const elements = {
  startScreen: document.getElementById("startScreen"),
  navigationScreen: document.getElementById("navigationScreen"),
  arrivedScreen: document.getElementById("arrivedScreen"),
  finishScreen: document.getElementById("finishScreen"),
  startConditionText: document.getElementById("startConditionText"),
  startButton: document.getElementById("startButton"),
  arrivedFinishButton: document.getElementById("arrivedFinishButton"),
  finishSaveLogButton: document.getElementById("finishSaveLogButton"),
  stepProgress: document.getElementById("stepProgress"),
  mapImage: document.getElementById("mapImage"),
  mapDestinationBadge: document.getElementById("mapDestinationBadge"),
  mapInstructionText: document.getElementById("mapInstructionText"),
  mapRemainingDistance: document.getElementById("mapRemainingDistance"),
  arrowSymbol: document.getElementById("arrowSymbol"),
  arrowActionText: document.getElementById("arrowActionText"),
  arrowSupportText: document.getElementById("arrowSupportText"),
  arrowSimpleMapImage: document.getElementById("arrowSimpleMapImage"),
  arrowRemainingDistance: document.getElementById("arrowRemainingDistance"),
  locationStatusText: document.getElementById("locationStatusText"),
  panelBackdrop: document.getElementById("panelBackdrop"),
  experimenterPanel: document.getElementById("experimenterPanel"),
  panelCloseButton: document.getElementById("panelCloseButton"),
  panelUiType: document.getElementById("panelUiType"),
  panelCondition: document.getElementById("panelCondition"),
  panelStep: document.getElementById("panelStep"),
  panelAccuracy: document.getElementById("panelAccuracy"),
  panelLatLng: document.getElementById("panelLatLng"),
  panelDistance: document.getElementById("panelDistance"),
  panelLogCount: document.getElementById("panelLogCount"),
  manualPrevButton: document.getElementById("manualPrevButton"),
  manualNextButton: document.getElementById("manualNextButton"),
  manualRestartButton: document.getElementById("manualRestartButton"),
  manualFinishButton: document.getElementById("manualFinishButton"),
  panelSaveLogButton: document.getElementById("panelSaveLogButton"),
};

document.body.dataset.ui = uiType;

elements.startButton.addEventListener("click", startExperiment);
elements.arrivedFinishButton.addEventListener("click", () => finishExperiment("arrived_screen"));
elements.finishSaveLogButton.addEventListener("click", () => saveLogFile("finish_screen"));
elements.panelSaveLogButton.addEventListener("click", () => saveLogFile("experimenter_panel"));
elements.panelCloseButton.addEventListener("click", closeExperimenterPanel);
elements.panelBackdrop.addEventListener("click", closeExperimenterPanel);
elements.manualPrevButton.addEventListener("click", manualPreviousStep);
elements.manualNextButton.addEventListener("click", manualNextStep);
elements.manualRestartButton.addEventListener("click", manualRestartExperiment);
elements.manualFinishButton.addEventListener("click", manualFinishExperiment);

document.querySelectorAll("[data-panel-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", handleTitleTap);
  trigger.addEventListener("pointerdown", startTitleLongPress);
  trigger.addEventListener("pointerup", cancelTitleLongPress);
  trigger.addEventListener("pointerleave", cancelTitleLongPress);
  trigger.addEventListener("pointercancel", cancelTitleLongPress);
});

render();

function normalizeUIType(value) {
  return value === "arrow" ? "arrow" : "map";
}

function normalizeCondition(value) {
  return value === "pressure" ? "pressure" : "normal";
}

function getCurrentStep() {
  return routeSteps[state.currentStepIndex] || null;
}

function getDestinationName(step = getCurrentStep()) {
  return step?.destinationName || routeMeta.destinationName || "目的地";
}

function startExperiment() {
  if (state.started && state.screen === "navigation") return;

  if (!navigator.geolocation) {
    state.locationStatus = "位置情報を利用できません";
    render();
    return;
  }

  state.started = true;
  state.arrived = false;
  state.finished = false;
  state.startedAt = Date.now();
  state.arrivedAt = null;
  state.finishedAt = null;
  state.currentStepIndex = 0;
  state.insideHitCount = 0;
  state.lastStepChangeAt = 0;
  state.locationStatus = "位置情報を取得中";
  state.screen = "navigation";

  writeLog("experiment_start", {
    pressureLimitSeconds: condition === "pressure" ? PRESSURE_LIMIT_SECONDS : null,
  });

  startGeolocationWatch();
  render();
}

function startGeolocationWatch() {
  stopGeolocationWatch();

  state.watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 15000,
  });
}

function stopGeolocationWatch() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
}

function handlePosition(position) {
  if (!state.started || state.finished || state.screen !== "navigation") return;

  const coords = position.coords;
  const currentStep = getCurrentStep();
  const distanceToTarget = currentStep
    ? calculateDistanceMeters(coords.latitude, coords.longitude, currentStep.target.lat, currentStep.target.lng)
    : null;

  state.latestPosition = {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    distanceToTarget,
  };

  state.locationStatus =
    coords.accuracy <= REQUIRED_ACCURACY_METERS ? "案内中" : "位置情報が不安定です";

  writeLog("gps", {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    distanceToTarget,
  });

  maybeAdvanceStep(coords.accuracy, distanceToTarget);
  render();
}

function handlePositionError(error) {
  const messages = {
    1: "位置情報の許可が必要です",
    2: "位置情報を取得できません",
    3: "位置情報を取得中",
  };

  state.locationStatus = messages[error.code] || "位置情報エラー";
  render();
}

function maybeAdvanceStep(accuracy, distanceToTarget) {
  const currentStep = getCurrentStep();
  if (!currentStep || distanceToTarget == null) return;

  const now = Date.now();
  if (now - state.lastStepChangeAt < STEP_COOLDOWN_MS) return;

  if (accuracy > REQUIRED_ACCURACY_METERS) {
    state.insideHitCount = 0;
    return;
  }

  if (distanceToTarget <= currentStep.triggerRadius) {
    state.insideHitCount += 1;
  } else {
    state.insideHitCount = 0;
  }

  if (state.insideHitCount < REQUIRED_CONSECUTIVE_HITS) return;

  if (state.currentStepIndex < routeSteps.length - 1) {
    const fromStep = currentStep.id;
    const oldDistanceToTarget = distanceToTarget;

    state.currentStepIndex += 1;
    state.insideHitCount = 0;
    state.lastStepChangeAt = now;
    refreshDistanceToCurrentTarget();

    writeLog("step_change", {
      fromStep,
      toStep: getCurrentStep()?.id || null,
      oldDistanceToTarget,
      method: "gps",
    });
    return;
  }

  showArrivedScreen("gps_arrival");
}

function showArrivedScreen(reason) {
  if (state.arrived || state.finished) return;

  state.arrived = true;
  state.arrivedAt = Date.now();
  state.screen = "arrived";
  state.locationStatus = "到着しました";
  stopGeolocationWatch();

  writeLog("arrived", {
    reason,
    elapsedMs: state.startedAt ? state.arrivedAt - state.startedAt : null,
  });

  render();
}

function finishExperiment(reason) {
  if (state.finished) return;

  state.finished = true;
  state.finishedAt = Date.now();
  state.screen = "finish";
  state.locationStatus = "実験終了";
  stopGeolocationWatch();

  writeLog("experiment_finish", {
    reason,
    elapsedMs: state.startedAt ? state.finishedAt - state.startedAt : null,
  });

  render();
}

function manualPreviousStep() {
  manualStepChange(-1, "manual_prev");
}

function manualNextStep() {
  manualStepChange(1, "manual_next");
}

function manualStepChange(direction, eventName) {
  const fromIndex = state.currentStepIndex;
  const fromStep = getCurrentStep()?.id || null;
  const nextIndex = clamp(fromIndex + direction, 0, Math.max(routeSteps.length - 1, 0));

  state.currentStepIndex = nextIndex;
  state.insideHitCount = 0;
  state.lastStepChangeAt = Date.now();
  refreshDistanceToCurrentTarget();

  writeLog(eventName, {
    fromIndex,
    toIndex: nextIndex,
    fromStep,
    toStep: getCurrentStep()?.id || null,
    changed: fromIndex !== nextIndex,
  });

  render();
}

function manualRestartExperiment() {
  writeLog("manual_restart", {
    previousScreen: state.screen,
    previousStep: getCurrentStep()?.id || null,
  });

  stopGeolocationWatch();
  state.screen = "start";
  state.currentStepIndex = 0;
  state.started = false;
  state.arrived = false;
  state.finished = false;
  state.startedAt = null;
  state.arrivedAt = null;
  state.finishedAt = null;
  state.insideHitCount = 0;
  state.lastStepChangeAt = 0;
  state.locationStatus = "開始前";
  state.latestPosition = {
    lat: null,
    lng: null,
    accuracy: null,
    distanceToTarget: null,
  };

  render();
}

function manualFinishExperiment() {
  writeLog("manual_finish", {
    previousScreen: state.screen,
    previousStep: getCurrentStep()?.id || null,
  });
  finishExperiment("manual_finish");
}

function render() {
  const currentStep = getCurrentStep();
  const totalSteps = routeSteps.length;
  const stepNumber = totalSteps > 0 ? state.currentStepIndex + 1 : 0;
  const remainingDistance = currentStep?.remainingDistance || "-";
  const destinationName = getDestinationName(currentStep);

  document.body.dataset.screen = state.screen;

  elements.startScreen.classList.toggle("is-hidden", state.screen !== "start");
  elements.navigationScreen.classList.toggle("is-hidden", state.screen !== "navigation");
  elements.arrivedScreen.classList.toggle("is-hidden", state.screen !== "arrived");
  elements.finishScreen.classList.toggle("is-hidden", state.screen !== "finish");

  elements.startConditionText.textContent = buildConditionNotice();
  elements.stepProgress.textContent = `${stepNumber} / ${totalSteps}`;
  elements.startButton.disabled = routeSteps.length === 0;

  if (currentStep) {
    const mainText = getStepMainText(currentStep);
    const subText = getStepSubText(currentStep);

    elements.mapImage.src = currentStep.mapImage;
    elements.mapDestinationBadge.textContent = destinationName;
    elements.mapInstructionText.textContent = subText || mainText;
    elements.mapRemainingDistance.textContent = remainingDistance;

    elements.arrowSymbol.textContent = currentStep.arrow;
    elements.arrowActionText.textContent = mainText;
    elements.arrowSupportText.textContent = subText;
    elements.arrowSimpleMapImage.src = getStepSimpleMapImage(currentStep);
    elements.arrowRemainingDistance.textContent = remainingDistance;
  }

  elements.locationStatusText.textContent = state.locationStatus;
  renderExperimenterPanel();
}

function renderExperimenterPanel() {
  const currentStep = getCurrentStep();
  const totalSteps = routeSteps.length;
  const stepNumber = totalSteps > 0 ? state.currentStepIndex + 1 : 0;
  const { lat, lng, accuracy, distanceToTarget } = state.latestPosition;

  elements.panelBackdrop.classList.toggle("is-hidden", !state.panelOpen);
  elements.experimenterPanel.classList.toggle("is-hidden", !state.panelOpen);
  elements.experimenterPanel.setAttribute("aria-hidden", String(!state.panelOpen));
  elements.panelUiType.textContent = uiType;
  elements.panelCondition.textContent = condition;
  elements.panelStep.textContent = `${stepNumber} / ${totalSteps}${currentStep ? ` (${currentStep.id})` : ""}`;
  elements.panelAccuracy.textContent = formatAccuracy(accuracy);
  elements.panelLatLng.textContent = formatLatLng(lat, lng);
  elements.panelDistance.textContent = formatDistance(distanceToTarget);
  elements.panelLogCount.textContent = String(state.logs.length);
}

function buildConditionNotice() {
  if (condition === "pressure") {
    return "時間制約条件です。制限時間を意識しながら、やや急いで目的地へ向かってください。";
  }

  return "通常条件です。普段の歩行速度で目的地へ向かってください。";
}

function getStepMainText(step) {
  return step?.mainText || "まっすぐ進む";
}

function getStepSubText(step) {
  return step?.subText || "正面の通路を直進してください。";
}

function getStepSimpleMapImage(step) {
  return step?.simpleMapImage || step?.mapImage || "";
}

function handleTitleTap() {
  state.titleTapCount += 1;
  window.clearTimeout(state.titleTapTimer);

  if (state.titleTapCount >= PANEL_TAP_COUNT) {
    state.titleTapCount = 0;
    openExperimenterPanel();
    return;
  }

  state.titleTapTimer = window.setTimeout(() => {
    state.titleTapCount = 0;
  }, PANEL_TAP_WINDOW_MS);
}

function startTitleLongPress() {
  cancelTitleLongPress();
  state.titleLongPressTimer = window.setTimeout(() => {
    state.titleTapCount = 0;
    openExperimenterPanel();
  }, PANEL_LONG_PRESS_MS);
}

function cancelTitleLongPress() {
  window.clearTimeout(state.titleLongPressTimer);
  state.titleLongPressTimer = null;
}

function openExperimenterPanel() {
  state.panelOpen = true;
  render();
}

function closeExperimenterPanel() {
  state.panelOpen = false;
  render();
}

function writeLog(eventName, details = {}) {
  const currentStep = getCurrentStep();
  const position = {
    lat: pickValue(details.lat, state.latestPosition.lat),
    lng: pickValue(details.lng, state.latestPosition.lng),
    accuracy: pickValue(details.accuracy, state.latestPosition.accuracy),
    distanceToTarget: pickValue(details.distanceToTarget, state.latestPosition.distanceToTarget),
  };

  state.logs.push({
    timestamp: new Date().toISOString(),
    event: eventName,
    uiType,
    condition,
    step: currentStep ? currentStep.id : null,
    stepIndex: state.currentStepIndex,
    lat: position.lat,
    lng: position.lng,
    accuracy: position.accuracy,
    distanceToTarget: position.distanceToTarget,
    ...details,
  });
}

function refreshDistanceToCurrentTarget() {
  const currentStep = getCurrentStep();
  const { lat, lng } = state.latestPosition;
  if (!currentStep || lat == null || lng == null) return;

  state.latestPosition.distanceToTarget = calculateDistanceMeters(
    lat,
    lng,
    currentStep.target.lat,
    currentStep.target.lng,
  );
}

function saveLogFile(source) {
  const payload = {
    meta: {
      app: "nav-experiment",
      exportedAt: new Date().toISOString(),
      uiType,
      condition,
      source,
      pressureLimitSeconds: condition === "pressure" ? PRESSURE_LIMIT_SECONDS : null,
      requiredAccuracyMeters: REQUIRED_ACCURACY_METERS,
      requiredConsecutiveHits: REQUIRED_CONSECUTIVE_HITS,
      stepCooldownMs: STEP_COOLDOWN_MS,
      userAgent: navigator.userAgent,
    },
    routeMeta,
    routeSteps,
    logs: state.logs,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const fileName = `nav_experiment_${uiType}_${condition}_${buildFileTimestamp()}.json`;
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function formatDistance(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

function formatAccuracy(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return `±${Math.round(value)} m`;
}

function formatLatLng(lat, lng) {
  if (lat == null || lng == null) return "-";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function buildFileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pickValue(primary, fallback) {
  return primary !== undefined ? primary : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
