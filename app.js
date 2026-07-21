const routeSteps = Array.isArray(window.routeSteps) ? window.routeSteps : [];
const routeMeta = window.routeMeta || {};

// Centralized experiment tuning values. Adjust these after field testing.
const EXPERIMENT_CONFIG = Object.freeze({
  PRESSURE_LIMIT_SECONDS: 300,
  MAX_ACCEPTABLE_ACCURACY: 35,
  REQUIRED_CONFIRMATION_HITS: 2,
  STEP_COOLDOWN_MS: 5000,
  DEFAULT_ACTION_DISTANCE: 30,
  DEFAULT_DECISION_RADIUS: 15,
  DEFAULT_TRIGGER_RADIUS: 20,
  DEFAULT_OFF_ROUTE_THRESHOLD_METERS: 25,
  PANEL_TAP_COUNT: 5,
  PANEL_TAP_WINDOW_MS: 1500,
  PANEL_LONG_PRESS_MS: 700,
});

const {
  PRESSURE_LIMIT_SECONDS,
  MAX_ACCEPTABLE_ACCURACY,
  REQUIRED_CONFIRMATION_HITS,
  STEP_COOLDOWN_MS,
  DEFAULT_ACTION_DISTANCE,
  DEFAULT_DECISION_RADIUS,
  DEFAULT_TRIGGER_RADIUS,
  DEFAULT_OFF_ROUTE_THRESHOLD_METERS,
  PANEL_TAP_COUNT,
  PANEL_TAP_WINDOW_MS,
  PANEL_LONG_PRESS_MS,
} = EXPERIMENT_CONFIG;

const params = new URLSearchParams(window.location.search);
const requestedRouteId = params.get("route") || routeMeta.routeId || null;
const uiType = normalizeUIType(params.get("ui"));
const condition = normalizeCondition(params.get("condition"));
const debugEnabled = normalizeDebugFlag(params.get("debug"));
const mockGpsEnabled = normalizeDebugFlag(params.get("mockGps"));

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
  confirmationHitCount: 0,
  lastStepChangeAt: 0,
  currentPhase: "preview",
  phaseStepIndex: 0,
  decisionPointEnteredSteps: new Set(),
  navigationFinishedLogged: false,
  locationStatus: "開始前",
  panelOpen: false,
  titleTapCount: 0,
  titleTapTimer: null,
  titleLongPressTimer: null,
  latestPosition: {
    lat: null,
    lng: null,
    accuracy: null,
    distanceToConfirmation: null,
    distanceToTarget: null,
    distanceToDecisionPoint: null,
    routeRemainingDistance: null,
    totalRemainingDistance: null,
    offRouteDistance: null,
    routeProgress: null,
    navigationMode: null,
    guidancePhase: null,
  },
  lastEvent: null,
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
  mapInstructionTitle: document.getElementById("mapInstructionTitle"),
  mapInstructionSubText: document.getElementById("mapInstructionSubText"),
  mapDistanceRow: document.getElementById("mapDistanceRow"),
  mapDistanceLabel: document.getElementById("mapDistanceLabel"),
  mapRemainingDistance: document.getElementById("mapRemainingDistance"),
  arrowSymbol: document.getElementById("arrowSymbol"),
  arrowActionText: document.getElementById("arrowActionText"),
  arrowSupportText: document.getElementById("arrowSupportText"),
  arrowSimpleMapImage: document.getElementById("arrowSimpleMapImage"),
  arrowDistanceRow: document.getElementById("arrowDistanceRow"),
  arrowDistanceLabel: document.getElementById("arrowDistanceLabel"),
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
  panelConfirmationDistance: document.getElementById("panelConfirmationDistance"),
  panelLogCount: document.getElementById("panelLogCount"),
  manualPrevButton: document.getElementById("manualPrevButton"),
  manualNextButton: document.getElementById("manualNextButton"),
  manualRestartButton: document.getElementById("manualRestartButton"),
  manualFinishButton: document.getElementById("manualFinishButton"),
  panelSaveLogButton: document.getElementById("panelSaveLogButton"),
  debugPanel: document.getElementById("debugPanel"),
  debugRouteId: document.getElementById("debugRouteId"),
  debugCurrentStepIndex: document.getElementById("debugCurrentStepIndex"),
  debugStepId: document.getElementById("debugStepId"),
  debugAction: document.getElementById("debugAction"),
  debugPhase: document.getElementById("debugPhase"),
  debugLatitude: document.getElementById("debugLatitude"),
  debugLongitude: document.getElementById("debugLongitude"),
  debugAccuracy: document.getElementById("debugAccuracy"),
  debugDistanceToDecision: document.getElementById("debugDistanceToDecision"),
  debugDistanceToConfirmation: document.getElementById("debugDistanceToConfirmation"),
  debugConfirmationHitCount: document.getElementById("debugConfirmationHitCount"),
  debugRequiredHitCount: document.getElementById("debugRequiredHitCount"),
  debugCooldownRemaining: document.getElementById("debugCooldownRemaining"),
  debugLastEvent: document.getElementById("debugLastEvent"),
  mockGpsControls: document.getElementById("mockGpsControls"),
};

document.body.dataset.ui = uiType;
document.body.dataset.debug = String(debugEnabled);
document.body.dataset.mockGps = String(mockGpsEnabled);

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

document.querySelectorAll("[data-mock-gps]").forEach((button) => {
  button.addEventListener("click", () => triggerMockGpsScenario(button.dataset.mockGps));
});

render();

function normalizeUIType(value) {
  return value === "arrow" || value === "action" ? "arrow" : "map";
}

function normalizeCondition(value) {
  return value === "pressure" ? "pressure" : "normal";
}

function normalizeDebugFlag(value) {
  return value === "true" || value === "1";
}

function getCurrentStep() {
  return routeSteps[state.currentStepIndex] || null;
}

function getDestinationName(step = getCurrentStep()) {
  return step?.destinationName || routeMeta.destinationName || "目的地";
}

function startExperiment() {
  if (state.started && state.screen === "navigation") return;

  if (!mockGpsEnabled && !navigator.geolocation) {
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
  state.confirmationHitCount = 0;
  state.lastStepChangeAt = 0;
  state.currentPhase = "preview";
  state.phaseStepIndex = 0;
  state.decisionPointEnteredSteps = new Set();
  state.navigationFinishedLogged = false;
  state.locationStatus = mockGpsEnabled ? "Mock GPSモード" : "位置情報を取得中";
  state.latestPosition = createEmptyLatestPosition();
  state.screen = "navigation";

  writeLog("experiment_start", {
    routeId: routeMeta.routeId || null,
    requestedRouteId,
    mockGpsEnabled,
    navigationMode: routeMeta.navigationMode || "target-radius",
    pressureLimitSeconds: condition === "pressure" ? PRESSURE_LIMIT_SECONDS : null,
  });
  writeLog("navigation_started", {
    reason: "start_button",
    requestedRouteId,
    mockGpsEnabled,
    navigationMode: routeMeta.navigationMode || "target-radius",
  });

  if (mockGpsEnabled) {
    stopGeolocationWatch();
  } else {
    startGeolocationWatch();
  }
  render();
}

function startGeolocationWatch() {
  stopGeolocationWatch();
  if (!navigator.geolocation) return;

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
  handlePositionUpdate(position.coords, {
    source: "gps",
  });
}

function handlePositionUpdate(coords, options = {}) {
  if (!state.started || state.finished || state.screen !== "navigation") return;

  const latitude = Number(coords.latitude ?? coords.lat);
  const longitude = Number(coords.longitude ?? coords.lng);
  const accuracy = Number(coords.accuracy);
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude) || !isFiniteNumber(accuracy)) return;

  const currentStep = getCurrentStep();
  const navigationMetrics = currentStep
    ? calculateTurnByTurnMetrics(latitude, longitude, currentStep)
    : createEmptyNavigationMetrics();
  const previousPhase = state.currentPhase;
  const guidancePhase = updateGuidancePhase(currentStep, navigationMetrics);
  const positionSource = options.source || "gps";

  state.latestPosition = {
    lat: latitude,
    lng: longitude,
    accuracy,
    distanceToConfirmation: navigationMetrics.distanceToConfirmation,
    distanceToTarget: navigationMetrics.distanceToTarget,
    distanceToDecisionPoint: navigationMetrics.distanceToDecisionPoint,
    routeRemainingDistance: navigationMetrics.routeRemainingDistance,
    totalRemainingDistance: navigationMetrics.totalRemainingDistance,
    offRouteDistance: navigationMetrics.offRouteDistance,
    routeProgress: navigationMetrics.routeProgress,
    navigationMode: navigationMetrics.navigationMode,
    guidancePhase,
  };

  state.locationStatus =
    accuracy <= MAX_ACCEPTABLE_ACCURACY ? "案内中" : "位置情報が不安定です";

  writeLog("gps", {
    lat: latitude,
    lng: longitude,
    accuracy,
    source: positionSource,
    mockGps: positionSource === "mockGps",
    mockScenario: options.scenarioId || null,
    mockLabel: options.label || null,
    distanceToConfirmation: navigationMetrics.distanceToConfirmation,
    distanceToTarget: navigationMetrics.distanceToTarget,
    distanceToDecisionPoint: navigationMetrics.distanceToDecisionPoint,
    routeRemainingDistance: navigationMetrics.routeRemainingDistance,
    totalRemainingDistance: navigationMetrics.totalRemainingDistance,
    offRouteDistance: navigationMetrics.offRouteDistance,
    routeProgress: navigationMetrics.routeProgress,
    navigationMode: navigationMetrics.navigationMode,
    guidancePhase: state.latestPosition.guidancePhase,
    distanceAlongStep: navigationMetrics.distanceAlongStep,
    stepRouteLength: navigationMetrics.stepRouteLength,
  });
  if (previousPhase !== guidancePhase) {
    writeLog("phase_changed", {
      fromPhase: previousPhase,
      toPhase: guidancePhase,
      phase: guidancePhase,
      reason: getPhaseChangeReason(currentStep, navigationMetrics, guidancePhase),
    });
  }
  maybeLogDecisionPointEntered(currentStep, navigationMetrics);

  maybeAdvanceStep(accuracy, navigationMetrics);
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

function maybeAdvanceStep(accuracy, navigationMetrics) {
  const currentStep = getCurrentStep();
  const distanceToConfirmation = navigationMetrics?.distanceToConfirmation;
  if (!currentStep || distanceToConfirmation == null) {
    state.confirmationHitCount = 0;
    return;
  }

  const now = Date.now();
  const accuracyAccepted = accuracy <= MAX_ACCEPTABLE_ACCURACY;
  const confirmationReached = isTurnByTurnAdvanceReady(currentStep, navigationMetrics);
  const cooldownSatisfied = now - state.lastStepChangeAt >= STEP_COOLDOWN_MS;

  if (!confirmationReached) {
    state.confirmationHitCount = 0;
    navigationMetrics.advanceReason = navigationMetrics.advanceReason || "confirmation_radius_miss";
    return;
  }

  if (!accuracyAccepted) {
    state.confirmationHitCount = 0;
    navigationMetrics.advanceReason = "accuracy_rejected";
    writeLog("confirmation_rejected_accuracy", {
      reason: "accuracy_exceeds_max_acceptable_accuracy",
      maxAcceptableAccuracy: MAX_ACCEPTABLE_ACCURACY,
      confirmationHitCount: 0,
    });
    return;
  }

  if (!cooldownSatisfied) {
    state.confirmationHitCount = 0;
    navigationMetrics.advanceReason = "cooldown_hold";
    return;
  }

  state.confirmationHitCount += 1;
  navigationMetrics.confirmationHitCount = state.confirmationHitCount;
  writeLog("confirmation_point_hit", {
    reason: "confirmation_point_reached",
    confirmationHitCount: state.confirmationHitCount,
    triggerRadius: getStepTriggerRadius(currentStep),
  });

  if (state.confirmationHitCount < REQUIRED_CONFIRMATION_HITS) return;

  writeLog("step_completed", {
    reason: "confirmation_point_reached",
    confirmationHitCount: state.confirmationHitCount,
    triggerRadius: getStepTriggerRadius(currentStep),
  });

  if (state.currentStepIndex < routeSteps.length - 1) {
    const fromStep = currentStep.id;
    const oldDistanceToTarget = distanceToConfirmation;

    state.currentStepIndex += 1;
    state.confirmationHitCount = 0;
    state.lastStepChangeAt = now;
    state.currentPhase = "preview";
    state.phaseStepIndex = state.currentStepIndex;
    refreshDistanceToCurrentTarget();

    writeLog("step_change", {
      fromStep,
      toStep: getCurrentStep()?.id || null,
      oldDistanceToConfirmation: distanceToConfirmation,
      oldDistanceToTarget,
      oldDistanceToDecisionPoint: navigationMetrics.distanceToDecisionPoint,
      oldRouteRemainingDistance: navigationMetrics.routeRemainingDistance,
      oldTotalRemainingDistance: navigationMetrics.totalRemainingDistance,
      offRouteDistance: navigationMetrics.offRouteDistance,
      routeProgress: navigationMetrics.routeProgress,
      advanceReason: navigationMetrics.advanceReason,
      confirmationHitCount: REQUIRED_CONFIRMATION_HITS,
      method: "turn_by_turn_gps",
    });
    return;
  }

  state.confirmationHitCount = 0;
  showArrivedScreen("turn_by_turn_gps_arrival");
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
  logNavigationFinished(reason);

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
  if (!state.arrived) {
    logNavigationFinished(reason);
  }

  render();
}

function manualPreviousStep() {
  manualStepChange(-1, "manual_previous");
}

function manualNextStep() {
  manualStepChange(1, "manual_next");
}

function manualStepChange(direction, eventName) {
  const fromIndex = state.currentStepIndex;
  const fromStep = getCurrentStep()?.id || null;
  const nextIndex = clamp(fromIndex + direction, 0, Math.max(routeSteps.length - 1, 0));

  state.currentStepIndex = nextIndex;
  state.confirmationHitCount = 0;
  state.lastStepChangeAt = Date.now();
  state.currentPhase = "preview";
  state.phaseStepIndex = nextIndex;
  refreshDistanceToCurrentTarget();

  writeLog(eventName, {
    fromIndex,
    toIndex: nextIndex,
    fromStep,
    toStep: getCurrentStep()?.id || null,
    changed: fromIndex !== nextIndex,
    reason: eventName,
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
  state.confirmationHitCount = 0;
  state.lastStepChangeAt = 0;
  state.currentPhase = "preview";
  state.phaseStepIndex = 0;
  state.decisionPointEnteredSteps = new Set();
  state.navigationFinishedLogged = false;
  state.locationStatus = "開始前";
  state.latestPosition = createEmptyLatestPosition();

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
    const guidance = getStepGuidance(currentStep);
    const distanceInfo = getParticipantDistanceInfo(currentStep, guidance.phase);

    document.body.dataset.phase = guidance.phase;
    elements.mapImage.src = currentStep.mapImage;
    elements.mapDestinationBadge.textContent = destinationName;
    elements.mapInstructionTitle.textContent = guidance.mainText;
    elements.mapInstructionSubText.textContent = guidance.subText;
    renderDistanceRow(elements.mapDistanceRow, elements.mapDistanceLabel, elements.mapRemainingDistance, distanceInfo);

    elements.arrowSymbol.textContent = getActionArrow(currentStep);
    elements.arrowActionText.textContent = guidance.mainText;
    elements.arrowSupportText.textContent = guidance.subText;
    elements.arrowSimpleMapImage.src = getStepSimpleMapImage(currentStep);
    renderDistanceRow(
      elements.arrowDistanceRow,
      elements.arrowDistanceLabel,
      elements.arrowRemainingDistance,
      distanceInfo,
    );
  }

  elements.locationStatusText.textContent = state.locationStatus;
  renderExperimenterPanel();
  renderDebugPanel();
}

function renderExperimenterPanel() {
  const currentStep = getCurrentStep();
  const totalSteps = routeSteps.length;
  const stepNumber = totalSteps > 0 ? state.currentStepIndex + 1 : 0;
  const { lat, lng, accuracy, distanceToTarget, distanceToConfirmation } = state.latestPosition;

  elements.panelBackdrop.classList.toggle("is-hidden", !state.panelOpen);
  elements.experimenterPanel.classList.toggle("is-hidden", !state.panelOpen);
  elements.experimenterPanel.setAttribute("aria-hidden", String(!state.panelOpen));
  elements.panelUiType.textContent = uiType;
  elements.panelCondition.textContent = condition;
  elements.panelStep.textContent = `${stepNumber} / ${totalSteps}${currentStep ? ` (${currentStep.id})` : ""}`;
  elements.panelAccuracy.textContent = formatAccuracy(accuracy);
  elements.panelLatLng.textContent = formatLatLng(lat, lng);
  elements.panelDistance.textContent = formatDistance(distanceToTarget);
  elements.panelConfirmationDistance.textContent = formatDistance(distanceToConfirmation);
  elements.panelLogCount.textContent = String(state.logs.length);
}

function renderDebugPanel() {
  if (!elements.debugPanel) return;

  elements.debugPanel.classList.toggle("is-hidden", !debugEnabled);
  elements.debugPanel.setAttribute("aria-hidden", String(!debugEnabled));
  if (!debugEnabled) return;

  const currentStep = getCurrentStep();
  const latestPosition = state.latestPosition;

  elements.debugRouteId.textContent = routeMeta.routeId || requestedRouteId || "-";
  elements.debugCurrentStepIndex.textContent = String(state.currentStepIndex);
  elements.debugStepId.textContent = currentStep?.id || "-";
  elements.debugAction.textContent = currentStep?.action || "-";
  elements.debugPhase.textContent = state.currentPhase || "-";
  elements.debugLatitude.textContent = formatCoordinate(latestPosition.lat);
  elements.debugLongitude.textContent = formatCoordinate(latestPosition.lng);
  elements.debugAccuracy.textContent = formatAccuracy(latestPosition.accuracy);
  elements.debugDistanceToDecision.textContent = formatDistance(
    latestPosition.distanceToDecisionPoint,
  );
  elements.debugDistanceToConfirmation.textContent = formatDistance(
    latestPosition.distanceToConfirmation,
  );
  elements.debugConfirmationHitCount.textContent = String(state.confirmationHitCount);
  elements.debugRequiredHitCount.textContent = String(REQUIRED_CONFIRMATION_HITS);
  elements.debugCooldownRemaining.textContent = formatCooldownRemaining(getCooldownRemainingMs());
  elements.debugLastEvent.textContent = formatLastEvent(state.lastEvent);
  if (elements.mockGpsControls) {
    elements.mockGpsControls.classList.toggle("is-hidden", !mockGpsEnabled);
  }
}

function triggerMockGpsScenario(scenarioId) {
  if (!mockGpsEnabled) return;

  if (!state.started || state.screen === "start") {
    startExperiment();
  }

  const scenario = getMockGpsScenario(scenarioId);
  if (!scenario) return;

  handlePositionUpdate(
    {
      latitude: scenario.point.lat,
      longitude: scenario.point.lng,
      accuracy: scenario.accuracy,
    },
    {
      source: "mockGps",
      scenarioId,
      label: scenario.label,
    },
  );
}

function getMockGpsScenario(scenarioId) {
  const goodAccuracy = 8;
  const poorAccuracy = MAX_ACCEPTABLE_ACCURACY + 45;
  const currentStep = getCurrentStep();

  switch (scenarioId) {
    case "start":
      return createMockGpsScenario(
        scenarioId,
        normalizeCoordinate(routeMeta.start) || getStepPath(routeSteps[0], 0)[0],
        goodAccuracy,
      );
    case "near-turn-1":
      return createMockGpsScenario(scenarioId, getMockNearDecisionPoint(0), goodAccuracy);
    case "decision-1":
      return createMockGpsScenario(scenarioId, getStepDecisionPoint(routeSteps[0]), goodAccuracy);
    case "confirmation-1":
      return createMockGpsScenario(scenarioId, getStepAdvancePoint(routeSteps[0]), goodAccuracy);
    case "near-turn-2":
      return createMockGpsScenario(scenarioId, getMockNearDecisionPoint(1), goodAccuracy);
    case "decision-2":
      return createMockGpsScenario(scenarioId, getStepDecisionPoint(routeSteps[1]), goodAccuracy);
    case "confirmation-2":
      return createMockGpsScenario(scenarioId, getStepAdvancePoint(routeSteps[1]), goodAccuracy);
    case "near-turn-3":
      return createMockGpsScenario(scenarioId, getMockNearDecisionPoint(2), goodAccuracy);
    case "decision-3":
      return createMockGpsScenario(scenarioId, getStepDecisionPoint(routeSteps[2]), goodAccuracy);
    case "confirmation-3":
      return createMockGpsScenario(scenarioId, getStepAdvancePoint(routeSteps[2]), goodAccuracy);
    case "near-destination":
      return createMockGpsScenario(
        scenarioId,
        getMockNearDestinationPoint(routeSteps.length - 1),
        goodAccuracy,
      );
    case "destination":
      return createMockGpsScenario(
        scenarioId,
        getStepAdvancePoint(routeSteps[routeSteps.length - 1]),
        goodAccuracy,
      );
    case "poor-accuracy":
      return createMockGpsScenario(
        scenarioId,
        getStepAdvancePoint(currentStep) ||
          normalizeCoordinate(state.latestPosition) ||
          normalizeCoordinate(routeMeta.start),
        poorAccuracy,
      );
    case "wrong-direction":
      return createMockGpsScenario(
        scenarioId,
        getMockWrongDirectionPoint(currentStep) || normalizeCoordinate(routeMeta.start),
        goodAccuracy,
      );
    case "wrong-after-turn-1":
      return createMockGpsScenario(scenarioId, getMockMissedTurnPoint(0), goodAccuracy);
    case "wrong-after-turn-2":
      return createMockGpsScenario(scenarioId, getMockMissedTurnPoint(1), goodAccuracy);
    case "wrong-after-turn-3":
      return createMockGpsScenario(scenarioId, getMockMissedTurnPoint(2), goodAccuracy);
    default:
      return null;
  }
}

function createMockGpsScenario(label, point, accuracy) {
  const normalizedPoint = normalizeCoordinate(point);
  if (!normalizedPoint) return null;

  return {
    label,
    point: normalizedPoint,
    accuracy,
  };
}

function getMockNearDecisionPoint(stepIndex) {
  const step = routeSteps[stepIndex];
  const decisionPoint = getStepDecisionPoint(step);
  if (!decisionPoint) return null;

  const path = getStepPath(step, stepIndex);
  const previousPoint = getPathPointBeforeDecision(path, decisionPoint) || getPreviousRoutePoint(stepIndex);
  const backDistance = Math.max(
    getDecisionRadius(step) + 4,
    Math.min(getActionDistance(step) - 4, 26),
  );

  return movePointToward(decisionPoint, previousPoint, backDistance);
}

function getMockNearDestinationPoint(stepIndex) {
  const step = routeSteps[stepIndex];
  const destinationPoint = getStepAdvancePoint(step);
  if (!destinationPoint) return null;

  const path = getStepPath(step, stepIndex);
  const previousPoint = path.length >= 2 ? path[path.length - 2] : getPreviousRoutePoint(stepIndex);
  const backDistance = getStepTriggerRadius(step) + 12;

  return movePointToward(destinationPoint, previousPoint, backDistance);
}

function getMockWrongDirectionPoint(step) {
  const decisionPoint = getStepDecisionPoint(step);
  const confirmationPoint = getStepAdvancePoint(step);
  if (!decisionPoint || !confirmationPoint) return null;

  if (coordinatesEqual(decisionPoint, confirmationPoint)) {
    return offsetCoordinateMeters(decisionPoint, 36, 36);
  }

  const oppositePoint = {
    lat: decisionPoint.lat + (decisionPoint.lat - confirmationPoint.lat),
    lng: decisionPoint.lng + (decisionPoint.lng - confirmationPoint.lng),
  };

  return movePointToward(decisionPoint, oppositePoint, getStepTriggerRadius(step) + 18);
}

function getMockMissedTurnPoint(stepIndex) {
  const step = routeSteps[stepIndex];
  const decisionPoint = getStepDecisionPoint(step);
  if (!step || !decisionPoint) return null;

  const path = getStepPath(step, stepIndex);
  const previousPoint = getPathPointBeforeDecision(path, decisionPoint) || getPreviousRoutePoint(stepIndex);
  const missedTurnDistance = getStepTriggerRadius(step) + 24;
  const missedTurnPoint = movePointAwayFrom(decisionPoint, previousPoint, missedTurnDistance);

  return ensureOutsideConfirmationRadius(missedTurnPoint, step);
}

function getPathPointBeforeDecision(path, decisionPoint) {
  if (!Array.isArray(path) || path.length < 2 || !decisionPoint) return null;

  for (let index = path.length - 1; index > 0; index -= 1) {
    const current = normalizeCoordinate(path[index]);
    if (!current || !coordinatesEqual(current, decisionPoint)) continue;

    return normalizeCoordinate(path[index - 1]);
  }

  return normalizeCoordinate(path[path.length - 2]);
}

function ensureOutsideConfirmationRadius(point, step) {
  const normalizedPoint = normalizeCoordinate(point);
  const confirmationPoint = getStepAdvancePoint(step);
  if (!normalizedPoint || !confirmationPoint) return normalizedPoint;

  const minimumDistance = getStepTriggerRadius(step) + 8;
  const currentDistance = calculateDistanceMeters(
    normalizedPoint.lat,
    normalizedPoint.lng,
    confirmationPoint.lat,
    confirmationPoint.lng,
  );

  if (currentDistance >= minimumDistance) return normalizedPoint;

  const pushedPoint = movePointToward(confirmationPoint, normalizedPoint, minimumDistance);
  return pushedPoint || offsetCoordinateMeters(confirmationPoint, minimumDistance, 0);
}

function movePointToward(fromPoint, toPoint, distanceMeters) {
  const from = normalizeCoordinate(fromPoint);
  const to = normalizeCoordinate(toPoint);
  if (!from) return null;
  if (!to || !isFiniteNumber(distanceMeters) || distanceMeters <= 0) return from;

  const totalDistance = calculateDistanceMeters(from.lat, from.lng, to.lat, to.lng);
  if (!isFiniteNumber(totalDistance) || totalDistance === 0) return from;

  const ratio = Math.min(distanceMeters / totalDistance, 1);
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

function movePointAwayFrom(fromPoint, awayPoint, distanceMeters) {
  const from = normalizeCoordinate(fromPoint);
  const away = normalizeCoordinate(awayPoint);
  if (!from) return null;
  if (!away || !isFiniteNumber(distanceMeters) || distanceMeters <= 0) return from;

  const totalDistance = calculateDistanceMeters(from.lat, from.lng, away.lat, away.lng);
  if (!isFiniteNumber(totalDistance) || totalDistance === 0) return from;

  const ratio = distanceMeters / totalDistance;
  return {
    lat: from.lat + (from.lat - away.lat) * ratio,
    lng: from.lng + (from.lng - away.lng) * ratio,
  };
}

function offsetCoordinateMeters(point, northMeters, eastMeters) {
  const origin = normalizeCoordinate(point);
  if (!origin) return null;

  const metersPerLat = 111_320;
  const metersPerLng = metersPerLat * Math.cos(toRadians(origin.lat));
  return {
    lat: origin.lat + northMeters / metersPerLat,
    lng: origin.lng + eastMeters / metersPerLng,
  };
}

function buildConditionNotice() {
  if (condition === "pressure") {
    return "時間制約条件です。制限時間を意識しながら、やや急いで目的地へ向かってください。";
  }

  return "通常条件です。普段の歩行速度で目的地へ向かってください。";
}

function getStepGuidance(step) {
  const phase = getStepGuidancePhase(step);
  const display =
    phase === "confirming"
      ? step?.confirmingDisplay || step?.actionDisplay
      : phase === "action"
        ? step?.actionDisplay
        : step?.preview;

  return {
    phase,
    mainText: display?.mainText || step?.mainText || "まっすぐ進む",
    subText: display?.subText || step?.subText || "正面の通路を直進してください。",
  };
}

function getStepGuidancePhase(step, metrics = state.latestPosition) {
  if (!step) return "preview";
  if (metrics === state.latestPosition) {
    ensurePhaseBelongsToCurrentStep();
    return state.currentPhase;
  }

  return calculateGuidancePhase(step, metrics, "preview");
}

function updateGuidancePhase(step, metrics) {
  if (!step) return "preview";
  ensurePhaseBelongsToCurrentStep();

  state.currentPhase = calculateGuidancePhase(step, metrics, state.currentPhase);
  return state.currentPhase;
}

function maybeLogDecisionPointEntered(step, metrics) {
  if (!step || !metrics) return;
  if (!isDecisionPointEntered(step, metrics)) return;
  if (state.decisionPointEnteredSteps.has(step.id)) return;

  state.decisionPointEnteredSteps.add(step.id);
  writeLog("decision_point_entered", {
    reason: "decision_radius_entered",
    decisionRadius: getDecisionRadius(step),
  });
}

function isDecisionPointEntered(step, metrics) {
  return (
    isFiniteNumber(metrics?.distanceToDecisionPoint) &&
    metrics.distanceToDecisionPoint <= getDecisionRadius(step)
  );
}

function getPhaseChangeReason(step, metrics, phase) {
  if (phase === "action") return "action_distance_reached";
  if (phase === "confirming") {
    if (isDecisionPointEntered(step, metrics)) return "decision_radius_entered";
    if (
      isFiniteNumber(metrics?.distanceToConfirmation) &&
      metrics.distanceToConfirmation <= getStepTriggerRadius(step)
    ) {
      return "confirmation_radius_entered";
    }
  }

  return "distance_updated";
}

function logNavigationFinished(reason) {
  if (state.navigationFinishedLogged) return;

  state.navigationFinishedLogged = true;
  writeLog("navigation_finished", {
    reason,
    elapsedMs: state.startedAt ? Date.now() - state.startedAt : null,
  });
}

function calculateGuidancePhase(step, metrics, currentPhase = "preview") {
  if (!step) return "preview";
  if (currentPhase === "confirming") return "confirming";

  const distanceToDecisionPoint = metrics?.distanceToDecisionPoint;
  const distanceToConfirmationPoint = metrics?.distanceToConfirmation ?? metrics?.distanceToTarget;

  if (
    isFiniteNumber(distanceToConfirmationPoint) &&
    distanceToConfirmationPoint <= getStepTriggerRadius(step)
  ) {
    return "confirming";
  }

  if (!isFiniteNumber(distanceToDecisionPoint)) return "preview";

  if (distanceToDecisionPoint <= getDecisionRadius(step)) {
    return "confirming";
  }

  return distanceToDecisionPoint <= getActionDistance(step) ? "action" : "preview";
}

function ensurePhaseBelongsToCurrentStep() {
  if (state.phaseStepIndex === state.currentStepIndex) return;

  state.currentPhase = "preview";
  state.phaseStepIndex = state.currentStepIndex;
}

function renderDistanceRow(rowElement, labelElement, valueElement, distanceInfo) {
  labelElement.textContent = distanceInfo.label;
  valueElement.textContent = distanceInfo.value;
  rowElement.classList.toggle("is-message", distanceInfo.mode === "message");
}

function getParticipantDistanceInfo(step, phase = getStepGuidancePhase(step)) {
  if (!step) {
    return { label: "残り距離", value: "-", mode: "distance" };
  }

  if (step.action === "arrive" || step.advanceType === "arrival") {
    return {
      label: "目的地まで",
      value: formatApproxDistance(
        pickFirstNumber(
          state.latestPosition.distanceToConfirmation,
          state.latestPosition.distanceToTarget,
          state.latestPosition.totalRemainingDistance,
        ),
      ),
      mode: "distance",
    };
  }

  const distanceToDecision = state.latestPosition.distanceToDecisionPoint;

  if (phase === "preview") {
    return {
      label: "曲がり角まで",
      value: formatApproxDistance(distanceToDecision),
      mode: "distance",
    };
  }

  if (phase === "action" && isFiniteNumber(distanceToDecision) && distanceToDecision >= 20) {
    return {
      label: "曲がり角まで",
      value: formatApproxDistance(distanceToDecision),
      mode: "distance",
    };
  }

  return {
    label: "案内",
    value: getImmediateActionText(step),
    mode: "message",
  };
}

function getDisplayRemainingDistance(step, phase = getStepGuidancePhase(step)) {
  return getParticipantDistanceInfo(step, phase).value;
}

function getDisplayDistanceLabel(step, phase = getStepGuidancePhase(step)) {
  return getParticipantDistanceInfo(step, phase).label;
}

function getImmediateActionText(step) {
  switch (step?.action) {
    case "turn-right":
      return "この曲がり角を右折してください";
    case "turn-left":
      return "この曲がり角を左折してください";
    case "arrive":
      return "前方のバス停が目的地です";
    default:
      return step?.actionDisplay?.subText || step?.subText || "このまま進んでください";
  }
}

function getActionArrow(step) {
  switch (step?.action) {
    case "turn-right":
      return "↱";
    case "turn-left":
      return "↰";
    case "straight":
    case "arrive":
      return "↑";
    default:
      return step?.arrow || "↑";
  }
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
    lat: pickValue(details.lat, pickValue(details.latitude, state.latestPosition.lat)),
    lng: pickValue(details.lng, pickValue(details.longitude, state.latestPosition.lng)),
    accuracy: pickValue(details.accuracy, state.latestPosition.accuracy),
    distanceToConfirmation: pickValue(
      details.distanceToConfirmation,
      state.latestPosition.distanceToConfirmation,
    ),
    distanceToTarget: pickValue(details.distanceToTarget, state.latestPosition.distanceToTarget),
    distanceToDecisionPoint: pickValue(
      details.distanceToDecisionPoint,
      state.latestPosition.distanceToDecisionPoint,
    ),
    routeRemainingDistance: pickValue(
      details.routeRemainingDistance,
      state.latestPosition.routeRemainingDistance,
    ),
    totalRemainingDistance: pickValue(
      details.totalRemainingDistance,
      state.latestPosition.totalRemainingDistance,
    ),
    offRouteDistance: pickValue(details.offRouteDistance, state.latestPosition.offRouteDistance),
    routeProgress: pickValue(details.routeProgress, state.latestPosition.routeProgress),
    navigationMode: pickValue(details.navigationMode, state.latestPosition.navigationMode),
    guidancePhase: pickValue(details.guidancePhase, state.latestPosition.guidancePhase),
  };
  const phase = pickValue(details.phase, pickValue(position.guidancePhase, state.currentPhase));
  const reason = pickValue(details.reason, pickValue(details.advanceReason, null));
  const confirmationHitCount = pickValue(
    details.confirmationHitCount,
    state.confirmationHitCount,
  );

  const logEntry = {
    timestamp: new Date().toISOString(),
    event: eventName,
    routeId: routeMeta.routeId || null,
    routeName: routeMeta.routeName || null,
    uiType,
    condition,
    stepId: currentStep ? currentStep.id : null,
    step: currentStep ? currentStep.id : null,
    stepIndex: state.currentStepIndex,
    action: currentStep?.action || null,
    phase,
    reason,
    latitude: position.lat,
    longitude: position.lng,
    lat: position.lat,
    lng: position.lng,
    accuracy: position.accuracy,
    distanceToDecision: position.distanceToDecisionPoint,
    distanceToConfirmation: position.distanceToConfirmation,
    distanceToTarget: position.distanceToTarget,
    distanceToDecisionPoint: position.distanceToDecisionPoint,
    confirmationHitCount,
    routeRemainingDistance: position.routeRemainingDistance,
    totalRemainingDistance: position.totalRemainingDistance,
    offRouteDistance: position.offRouteDistance,
    routeProgress: position.routeProgress,
    navigationMode: position.navigationMode,
    guidancePhase: position.guidancePhase,
    ...details,
  };

  state.logs.push(logEntry);
  state.lastEvent = logEntry;
}

function refreshDistanceToCurrentTarget() {
  const currentStep = getCurrentStep();
  const { lat, lng } = state.latestPosition;
  if (!currentStep || lat == null || lng == null) return;

  const navigationMetrics = calculateTurnByTurnMetrics(lat, lng, currentStep);
  state.latestPosition.distanceToConfirmation = navigationMetrics.distanceToConfirmation;
  state.latestPosition.distanceToTarget = navigationMetrics.distanceToTarget;
  state.latestPosition.distanceToDecisionPoint = navigationMetrics.distanceToDecisionPoint;
  state.latestPosition.routeRemainingDistance = navigationMetrics.routeRemainingDistance;
  state.latestPosition.totalRemainingDistance = navigationMetrics.totalRemainingDistance;
  state.latestPosition.offRouteDistance = navigationMetrics.offRouteDistance;
  state.latestPosition.routeProgress = navigationMetrics.routeProgress;
  state.latestPosition.navigationMode = navigationMetrics.navigationMode;
  state.latestPosition.guidancePhase = updateGuidancePhase(currentStep, navigationMetrics);
}

function saveLogFile(source) {
  const payload = {
    meta: {
      app: "nav-experiment",
      exportedAt: new Date().toISOString(),
      uiType,
      condition,
      source,
      routeId: routeMeta.routeId || null,
      requestedRouteId,
      debugEnabled,
      mockGpsEnabled,
      navigationMode: routeMeta.navigationMode || "target-radius",
      advanceLogic: "decision-point-confirmation-point",
      experimentConfig: EXPERIMENT_CONFIG,
      pressureLimitSeconds: condition === "pressure" ? PRESSURE_LIMIT_SECONDS : null,
      maxAcceptableAccuracy: MAX_ACCEPTABLE_ACCURACY,
      requiredConfirmationHits: REQUIRED_CONFIRMATION_HITS,
      requiredAccuracyMeters: MAX_ACCEPTABLE_ACCURACY,
      requiredConsecutiveHits: REQUIRED_CONFIRMATION_HITS,
      stepCooldownMs: STEP_COOLDOWN_MS,
      defaultOffRouteThresholdMeters: DEFAULT_OFF_ROUTE_THRESHOLD_METERS,
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

function createEmptyLatestPosition() {
  return {
    lat: null,
    lng: null,
    accuracy: null,
    distanceToConfirmation: null,
    distanceToTarget: null,
    distanceToDecisionPoint: null,
    routeRemainingDistance: null,
    totalRemainingDistance: null,
    offRouteDistance: null,
    routeProgress: null,
    navigationMode: null,
  };
}

function createEmptyNavigationMetrics() {
  return {
    distanceToConfirmation: null,
    distanceToTarget: null,
    distanceToDecisionPoint: null,
    routeRemainingDistance: null,
    totalRemainingDistance: null,
    offRouteDistance: null,
    routeProgress: null,
    navigationMode: null,
    distanceAlongStep: null,
    stepRouteLength: null,
    advanceReason: null,
  };
}

function calculateTurnByTurnMetrics(lat, lng, step) {
  const metrics = createEmptyNavigationMetrics();
  const stepIndex = getStepIndex(step);
  const decisionPoint = getStepDecisionPoint(step);
  const advancePoint = getStepAdvancePoint(step);

  if (decisionPoint) {
    metrics.distanceToDecisionPoint = calculateDistanceMeters(
      lat,
      lng,
      decisionPoint.lat,
      decisionPoint.lng,
    );
  }

  if (advancePoint) {
    metrics.distanceToConfirmation = calculateDistanceMeters(
      lat,
      lng,
      advancePoint.lat,
      advancePoint.lng,
    );
    metrics.distanceToTarget = metrics.distanceToConfirmation;
    metrics.routeRemainingDistance = metrics.distanceToTarget;
    metrics.totalRemainingDistance =
      metrics.routeRemainingDistance + calculateFutureRouteLength(stepIndex);
  }

  const path = getStepPath(step, stepIndex);

  // A route path lets the app judge progress along the current instruction
  // segment. Older routes without path still use the target-radius fallback.
  if (path.length < 2) {
    metrics.navigationMode = "target-radius";
    return metrics;
  }

  const routeProgress = calculatePolylineProgress(lat, lng, path);
  if (!routeProgress) {
    metrics.navigationMode = "target-radius";
    return metrics;
  }

  metrics.navigationMode = "turn-by-turn";
  metrics.routeRemainingDistance = routeProgress.routeRemainingDistance;
  metrics.offRouteDistance = routeProgress.offRouteDistance;
  metrics.routeProgress = routeProgress.routeProgress;
  metrics.distanceAlongStep = routeProgress.distanceAlongStep;
  metrics.stepRouteLength = routeProgress.stepRouteLength;
  metrics.totalRemainingDistance =
    routeProgress.routeRemainingDistance + calculateFutureRouteLength(stepIndex);

  return metrics;
}

function isTurnByTurnAdvanceReady(step, navigationMetrics) {
  if (!navigationMetrics) return false;

  const triggerRadius = getStepTriggerRadius(step);
  const distanceToConfirmation = navigationMetrics.distanceToConfirmation;
  const confirmationReached =
    isFiniteNumber(distanceToConfirmation) && distanceToConfirmation <= triggerRadius;

  if (confirmationReached) {
    if (isStillAtDecisionPoint(step, navigationMetrics)) {
      navigationMetrics.advanceReason = "decision_point_only";
      return false;
    }

    navigationMetrics.advanceReason =
      step?.advanceType === "arrival" ? "confirmation_arrival_point" : "confirmation_point";
    return true;
  }

  navigationMetrics.advanceReason = "confirmation_radius_miss";
  return false;
}

function isStillAtDecisionPoint(step, metrics) {
  const decisionPoint = getStepDecisionPoint(step);
  const confirmationPoint = getStepAdvancePoint(step);

  if (!decisionPoint || !confirmationPoint) return false;
  if (coordinatesEqual(decisionPoint, confirmationPoint)) return false;

  return (
    isFiniteNumber(metrics?.distanceToDecisionPoint) &&
    metrics.distanceToDecisionPoint <= getDecisionRadius(step)
  );
}

function getStepPath(step, stepIndex = state.currentStepIndex) {
  if (!step) return [];

  if (Array.isArray(step.path)) {
    const path = step.path.map(normalizeCoordinate).filter(Boolean);
    if (path.length >= 2) return path;
  }

  const target = getStepAdvancePoint(step);
  const previousPoint = getPreviousRoutePoint(stepIndex);

  if (previousPoint && target) return [previousPoint, target];
  return target ? [target] : [];
}

function getStepAdvancePoint(step) {
  return normalizeCoordinate(step?.confirmationPoint) || normalizeCoordinate(step?.target);
}

function getStepDecisionPoint(step) {
  return normalizeCoordinate(step?.decisionPoint) || getStepAdvancePoint(step);
}

function getPreviousRoutePoint(stepIndex = state.currentStepIndex) {
  if (stepIndex > 0) {
    return getStepAdvancePoint(routeSteps[stepIndex - 1]);
  }

  return normalizeCoordinate(routeMeta.start);
}

function getStepIndex(step) {
  const index = routeSteps.indexOf(step);
  return index >= 0 ? index : state.currentStepIndex;
}

function calculateFutureRouteLength(currentStepIndex) {
  if (!Number.isInteger(currentStepIndex) || currentStepIndex < 0) return 0;

  let futureLength = 0;
  for (let index = currentStepIndex + 1; index < routeSteps.length; index += 1) {
    futureLength += calculatePathLengthMeters(getStepPath(routeSteps[index], index));
  }

  return futureLength;
}

function calculatePathLengthMeters(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;

  let length = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = normalizeCoordinate(path[index]);
    const to = normalizeCoordinate(path[index + 1]);
    if (!from || !to) continue;

    length += calculateDistanceMeters(from.lat, from.lng, to.lat, to.lng);
  }

  return length;
}

function calculatePolylineProgress(lat, lng, path) {
  const origin = path[0];
  const metersPerLat = 111_320;
  const metersPerLng = metersPerLat * Math.cos(toRadians(origin.lat));
  const current = toLocalMeters({ lat, lng }, origin, metersPerLat, metersPerLng);
  const points = path.map((point) => toLocalMeters(point, origin, metersPerLat, metersPerLng));

  let bestOffRouteDistance = Infinity;
  let bestDistanceAlongStep = 0;
  let accumulatedLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const segmentLengthSquared = dx * dx + dy * dy;

    if (segmentLengthSquared === 0) continue;

    const segmentLength = Math.sqrt(segmentLengthSquared);
    const projectionRatio = clamp(
      ((current.x - segmentStart.x) * dx + (current.y - segmentStart.y) * dy) /
        segmentLengthSquared,
      0,
      1,
    );
    const projectedX = segmentStart.x + projectionRatio * dx;
    const projectedY = segmentStart.y + projectionRatio * dy;
    const offRouteDistance = Math.hypot(current.x - projectedX, current.y - projectedY);
    const distanceAlongStep = accumulatedLength + projectionRatio * segmentLength;

    if (offRouteDistance < bestOffRouteDistance) {
      bestOffRouteDistance = offRouteDistance;
      bestDistanceAlongStep = distanceAlongStep;
    }

    accumulatedLength += segmentLength;
  }

  if (accumulatedLength === 0 || bestOffRouteDistance === Infinity) return null;

  return {
    distanceAlongStep: bestDistanceAlongStep,
    stepRouteLength: accumulatedLength,
    routeRemainingDistance: Math.max(0, accumulatedLength - bestDistanceAlongStep),
    offRouteDistance: bestOffRouteDistance,
    routeProgress: clamp(bestDistanceAlongStep / accumulatedLength, 0, 1),
  };
}

function toLocalMeters(point, origin, metersPerLat, metersPerLng) {
  return {
    x: (point.lng - origin.lng) * metersPerLng,
    y: (point.lat - origin.lat) * metersPerLat,
  };
}

function getStepTriggerRadius(step) {
  const radius = Number(step?.advanceRadius ?? step?.triggerRadius);
  return Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_TRIGGER_RADIUS;
}

function getOffRouteThreshold(step) {
  const threshold = Number(step?.offRouteThreshold ?? routeMeta.offRouteThreshold);
  return Number.isFinite(threshold) && threshold > 0
    ? threshold
    : DEFAULT_OFF_ROUTE_THRESHOLD_METERS;
}

function getActionDistance(step) {
  const distance = Number(
    step?.actionDistance ??
      routeMeta.actionDistance ??
      step?.actionDisplayRadius ??
      routeMeta.actionDisplayRadius,
  );
  return Number.isFinite(distance) && distance > 0 ? distance : DEFAULT_ACTION_DISTANCE;
}

function getDecisionRadius(step) {
  const radius = Number(step?.decisionRadius ?? routeMeta.decisionRadius);
  return Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_DECISION_RADIUS;
}

function normalizeCoordinate(point) {
  if (!point) return null;

  const lat = Number(point.lat);
  const lng = Number(point.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function coordinatesEqual(a, b) {
  return (
    isFiniteNumber(a?.lat) &&
    isFiniteNumber(a?.lng) &&
    isFiniteNumber(b?.lat) &&
    isFiniteNumber(b?.lng) &&
    Math.abs(a.lat - b.lat) < 0.0000001 &&
    Math.abs(a.lng - b.lng) < 0.0000001
  );
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

function formatApproxDistance(value) {
  if (value == null || Number.isNaN(value)) return "-";

  if (value >= 1000) {
    return `約${(value / 1000).toFixed(1)} km`;
  }

  const roundedMeters = Math.round(value / 10) * 10;
  const displayMeters = value > 0 && roundedMeters === 0 ? 10 : roundedMeters;
  return `約${displayMeters} m`;
}

function formatAccuracy(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return `±${Math.round(value)} m`;
}

function formatCoordinate(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(6);
}

function formatLatLng(lat, lng) {
  if (lat == null || lng == null) return "-";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function getCooldownRemainingMs() {
  if (!state.lastStepChangeAt) return 0;
  return Math.max(0, STEP_COOLDOWN_MS - (Date.now() - state.lastStepChangeAt));
}

function formatCooldownRemaining(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 ms";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.ceil(value)} ms`;
}

function formatLastEvent(event) {
  if (!event) return "-";

  const reason = event.reason ? ` / ${event.reason}` : "";
  return `${event.event}${reason}`;
}

function buildFileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pickValue(primary, fallback) {
  return primary !== undefined ? primary : fallback;
}

function pickFirstNumber(...values) {
  return values.find((value) => isFiniteNumber(value)) ?? null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
