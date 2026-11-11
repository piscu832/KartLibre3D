// Motor Principal de Juego:
// - Formato Oficial de 3 Etapas:
//   1) Reconocimiento (1 Vuelta)
//   2) Clasificación (3 Vueltas) -> Ordena la Parrilla de Salida según mejor tiempo de vuelta
//   3) Carrera Final (30 Vueltas) con los 8 corredores compitiendo contra el usuario
// - IA Competitiva sobre trazado de 10 curvas con adelantamientos y colisiones rueda a rueda
// - Cámaras Duales (Cockpit 1ª Persona / Exterior 3ª Persona)

(function () {
  const STAGE_CONFIG = {
    RECON: {
      id: "RECON",
      stepNumber: 1,
      title: "ETAPA 1/3 • VUELTA DE RECONOCIMIENTO",
      shortTitle: "Reconocimiento (1 Vuelta)",
      laps: 1,
      nextStage: "QUALY"
    },
    QUALY: {
      id: "QUALY",
      stepNumber: 2,
      title: "ETAPA 2/3 • CLASIFICACIÓN (3 VUELTAS)",
      shortTitle: "Clasificación (3 Vueltas)",
      laps: 3,
      nextStage: "RACE"
    },
    RACE: {
      id: "RACE",
      stepNumber: 3,
      title: "ETAPA 3/3 • CARRERA FINAL (20 VUELTAS)",
      shortTitle: "Carrera Final (20 Vueltas)",
      laps: 20,
      nextStage: null
    }
  };

  // Configuración de los 3 Niveles de Dificultad de la IA (Fácil, Medio, Difícil)
  // - Fácil: equivale a la dificultad que antes tenía el nivel Medio
  // - Medio: equivale a la dificultad que antes tenía el nivel Difícil
  // - Difícil: dificultad superior de nivel experto (ritmo de punta, paso por curva agresivo y aceleración máxima)
  const DIFFICULTY_CONFIG = {
    EASY: {
      id: "EASY",
      label: "🟢 Fácil",
      paceMult: 0.94,
      cornerSpeedMult: 0.94,
      accelMult: 0.96,
      linePrecision: 0.82,
      overtakeRate: 2.2,
      qualyBaseSec: 36.5
    },
    MEDIUM: {
      id: "MEDIUM",
      label: "🟡 Medio",
      paceMult: 1.03,
      cornerSpeedMult: 1.02,
      accelMult: 1.14,
      linePrecision: 1.00,
      overtakeRate: 3.0,
      qualyBaseSec: 33.2
    },
    HARD: {
      id: "HARD",
      label: "🔴 Difícil",
      paceMult: 1.14,
      cornerSpeedMult: 1.12,
      accelMult: 1.35,
      linePrecision: 1.00,
      overtakeRate: 3.8,
      qualyBaseSec: 29.8
    }
  };

  // Inmutabilidad de configuraciones críticas contra manipulación por consola o Prototype Pollution
  Object.keys(STAGE_CONFIG).forEach((k) => Object.freeze(STAGE_CONFIG[k]));
  Object.freeze(STAGE_CONFIG);
  Object.keys(DIFFICULTY_CONFIG).forEach((k) => Object.freeze(DIFFICULTY_CONFIG[k]));
  Object.freeze(DIFFICULTY_CONFIG);
  if (window.KART_MODEL_PARTS) {
    Object.freeze(window.KART_MODEL_PARTS);
  }

  // Sanitizador estricto de colores hexadecimales para prevenir inyección CSS
  function safeHexColor(val, fallback) {
    return typeof val === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(val) ? val : (fallback || "#38BDF8");
  }

  const MAX_SPEED_MPS = 29.5; // ~106 km/h velocidad máxima en recta

  let scene, renderer, camera;
  let sunLight, ambientLight, hemiLight;
  let track = null;
  let weather = null;
  let audio = null;
  let net = null;

  // Estados: "MENU" | "COUNTDOWN" | "RACING" | "PAUSED" | "STAGE_COMPLETE" | "FINISHED"
  let gameState = "MENU";
  let stateBeforePause = "RACING";
  let currentStage = "RECON";
  let currentDifficulty = "MEDIUM";
  let selectedRacerId = 1;
  let isRainMode = true;
  let cameraMode = "CHASE";

  // Orden de largada de los 8 corredores (se actualiza tras la Clasificación de 3 vueltas)
  let currentGridOrder = window.RACERS_LIST.slice();

  let karts = [];
  let playerKart = null;
  let raceTime = 0;
  let countdownTimer = 0;
  let lastBeepSec = -1;

  const input = {
    throttle: 0,
    brake: 0,
    left: 0,
    right: 0,
    boost: false
  };
  const keys = {};

  const isMobilePlatform = () => {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "") ||
      (window.matchMedia && window.matchMedia("(max-width: 900px)").matches)
    );
  };

  // ==================== CONFIGURACIÓN DEL USUARIO Y PERSISTENCIA (LOCALSTORAGE) ====================
  const SETTINGS_KEY = "kartlibre3d_user_settings";
  const appSettings = {
    steerSensitivity: 1.0,        // 0.5 a 2.0 (50% a 200%, default 100%)
    controlMode: "JOYSTICK",      // Predeterminado: "JOYSTICK" | "ACCELEROMETER"
    invertAccelerometer: true,    // true: derecha es izquierda y viceversa
    audioEnabled: true,           // true o false
    difficulty: "MEDIUM",         // "EASY" | "MEDIUM" | "HARD"
    rainMode: true,               // true (lluvia) | false (seco)
    raceLaps: 20                  // Vueltas para la Carrera Final (1 a 100, default 20)
  };

  function loadSavedSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.steerSensitivity === "number" && !isNaN(parsed.steerSensitivity)) {
          appSettings.steerSensitivity = Math.max(0.5, Math.min(2.0, parsed.steerSensitivity));
        }
        if (parsed.controlMode === "ACCELEROMETER" || parsed.controlMode === "JOYSTICK") {
          appSettings.controlMode = parsed.controlMode;
        } else {
          appSettings.controlMode = "JOYSTICK";
        }
        if (typeof parsed.invertAccelerometer === "boolean") {
          appSettings.invertAccelerometer = parsed.invertAccelerometer;
        }
        if (typeof parsed.audioEnabled === "boolean") {
          appSettings.audioEnabled = parsed.audioEnabled;
        }
        if (parsed.difficulty === "EASY" || parsed.difficulty === "MEDIUM" || parsed.difficulty === "HARD") {
          appSettings.difficulty = parsed.difficulty;
        }
        if (typeof parsed.rainMode === "boolean") {
          appSettings.rainMode = parsed.rainMode;
        }
        if (typeof parsed.raceLaps === "number" && parsed.raceLaps >= 1 && parsed.raceLaps <= 100) {
          appSettings.raceLaps = Math.round(parsed.raceLaps);
        }
      }
    } catch (e) {
      console.warn("No se pudo leer localStorage:", e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage:", e);
    }
  }

  function applyRaceLaps(laps) {
    const num = Math.max(1, Math.min(100, parseInt(laps, 10) || 20));
    appSettings.raceLaps = num;
    STAGE_CONFIG.RACE.laps = num;
    STAGE_CONFIG.RACE.title = `ETAPA 3/3 • CARRERA FINAL (${num} VUELTAS)`;
    STAGE_CONFIG.RACE.shortTitle = `Carrera Final (${num} Vueltas)`;

    const pillRace = document.getElementById("format-pill-race");
    if (pillRace) pillRace.textContent = `3° Carrera (${num}V)`;

    const menuLaps = document.getElementById("menu-laps-span");
    if (menuLaps) menuLaps.textContent = `${num} Vueltas de Carrera Final`;

    const lapsDisplay = document.getElementById("setting-laps-display");
    if (lapsDisplay) lapsDisplay.textContent = `${num} Vueltas`;

    const lapsInput = document.getElementById("setting-race-laps");
    if (lapsInput) lapsInput.value = num;

    document.querySelectorAll(".laps-pill").forEach((p) => {
      p.classList.toggle("active", parseInt(p.getAttribute("data-laps"), 10) === num);
    });
  }

  function updateControlModeUI() {
    const joyBase = document.getElementById("steer-joystick-base");
    const accelContainer = document.getElementById("accel-steer-container");
    const invertGroup = document.getElementById("setting-group-invert-accel");

    const mode = appSettings.controlMode === "ACCELEROMETER" ? "ACCELEROMETER" : "JOYSTICK";
    const isAccel = mode === "ACCELEROMETER";

    if (accelContainer) {
      accelContainer.style.display = isAccel ? "flex" : "none";
    }
    if (joyBase) {
      joyBase.style.display = isAccel ? "none" : "flex";
      if (!isAccel) {
        joyBase.classList.remove("desktop-only-joystick");
      } else {
        joyBase.classList.add("desktop-only-joystick");
      }
    }
    if (invertGroup) {
      invertGroup.style.display = isAccel ? "flex" : "none";
    }

    const btnAccel = document.getElementById("btn-control-accel");
    const btnJoy = document.getElementById("btn-control-joystick");
    if (btnAccel) btnAccel.classList.toggle("active", isAccel);
    if (btnJoy) btnJoy.classList.toggle("active", !isAccel);
  }

  function applyAllSettings() {
    // 1. Sensibilidad de giro
    const sensInput = document.getElementById("setting-steer-sens");
    const sensVal = document.getElementById("setting-steer-sens-val");
    const sensPercent = Math.round((appSettings.steerSensitivity || 1.0) * 100);
    if (sensInput) sensInput.value = sensPercent;
    if (sensVal) sensVal.textContent = sensPercent + "%";

    // 2. Control móvil (Acelerómetro vs Joystick)
    updateControlModeUI();

    // 3. Inversión acelerómetro
    const btnInvertOn = document.getElementById("btn-invert-accel-on");
    const btnInvertOff = document.getElementById("btn-invert-accel-off");
    if (btnInvertOn) btnInvertOn.classList.toggle("active", appSettings.invertAccelerometer);
    if (btnInvertOff) btnInvertOff.classList.toggle("active", !appSettings.invertAccelerometer);

    // 4. Audio
    const btnAudioOn = document.getElementById("btn-audio-on");
    const btnAudioOff = document.getElementById("btn-audio-off");
    if (btnAudioOn) btnAudioOn.classList.toggle("active", appSettings.audioEnabled);
    if (btnAudioOff) btnAudioOff.classList.toggle("active", !appSettings.audioEnabled);
    if (audio) audio.setMuted(!appSettings.audioEnabled);
    const hudAudio = document.getElementById("btn-toggle-audio");
    if (hudAudio) hudAudio.textContent = appSettings.audioEnabled ? "🔊" : "🔇";

    // 5. Dificultad
    currentDifficulty = appSettings.difficulty;
    document.querySelectorAll(".diff-pill, .setting-diff-pill").forEach((p) => {
      p.classList.toggle("active", p.getAttribute("data-diff") === currentDifficulty);
    });
    const hudDiffEl = document.getElementById("hud-diff-label");
    if (hudDiffEl && DIFFICULTY_CONFIG[currentDifficulty]) {
      hudDiffEl.textContent = DIFFICULTY_CONFIG[currentDifficulty].label;
    }

    // 6. Clima
    isRainMode = appSettings.rainMode;
    document.querySelectorAll(".weather-pill, .setting-weather-pill").forEach((p) => {
      p.classList.toggle("active", (p.getAttribute("data-rain") === "true") === isRainMode);
    });
    setupSkyAndLights(isRainMode);
    if (track) track.setWeatherMode(isRainMode);
    if (weather) weather.setRainMode(isRainMode);
    const btnWeather = document.getElementById("btn-weather-label");
    if (btnWeather) {
      btnWeather.textContent = isRainMode ? "Clima: Lluvia (Mojado)" : "Clima: Soleado (Seco)";
    }

    // 7. Vueltas carrera final
    applyRaceLaps(appSettings.raceLaps);
  }

  // ==================== CONTROL POR ACELERÓMETRO EN DISPOSITIVOS MÓVILES ====================
  let accelActive = false;
  let rawTiltDeg = 0;
  let tiltZeroOffset = 0;
  let targetTiltSteer = 0;
  let smoothTiltSteer = 0;

  function getScreenOrientationAngle() {
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number") {
      return window.screen.orientation.angle;
    }
    if (typeof window.orientation === "number") {
      return window.orientation;
    }
    return 0;
  }

  // Convierte el vector de gravedad 3D a coordenadas del plano de pantalla del jugador.
  // Es matemáticamente independiente del ángulo de reclinación hacia la cara del usuario.
  function calculateScreenTilt(gx, gy, gz) {
    const angle = getScreenOrientationAngle();
    let sx = 0;
    let sy = 0;

    if (angle === 90) {
      // Landscape primario (teléfono rotado 90° antihorario, parte superior a la izquierda):
      // Eje horizontal de pantalla (derecha del piloto) apunta hacia -Y del dispositivo.
      // Eje vertical de pantalla (arriba del piloto) apunta hacia +X del dispositivo.
      sx = -gy;
      sy = gx;
    } else if (angle === 270 || angle === -90) {
      // Landscape secundario (parte superior a la derecha)
      sx = gy;
      sy = -gx;
    } else if (angle === 180) {
      // Portrait invertido
      sx = -gx;
      sy = -gy;
    } else {
      // Portrait vertical estándar (0°)
      sx = gx;
      sy = gy;
    }

    const denom = -sy;
    if (Math.abs(denom) < 0.25 && Math.abs(sx) < 0.25) {
      return 0; // Dispositivo plano horizontal
    }

    // atan2(sx, denom):
    // - Si sx > 0 (inclinación hacia la derecha): ángulo positivo (giro a la DERECHA)
    // - Si sx < 0 (inclinación hacia la izquierda): ángulo negativo (giro a la IZQUIERDA)
    const rad = Math.atan2(sx, Math.max(0.15, denom));
    return rad * (180 / Math.PI);
  }

  function processTiltAngle(degrees) {
    if (appSettings.controlMode !== "ACCELEROMETER") return;
    accelActive = true;
    const adjusted = degrees - tiltZeroOffset;
    rawTiltDeg = THREE.MathUtils.clamp(adjusted, -45, 45);

    // Calibración ergonómica natural de competición:
    // - Zona muerta pequeña (1.8°): absorbe temblores en rectas sin perder precisión
    // - Rango máximo cómodo (21.0°): entrega el 100% de giro sin torcer muñecas
    // - Curva casi lineal progresiva (exponente 1.10): excelente control en curvas rápidas y horquillas
    const deadzone = 1.8;
    const maxTilt = 21.0;
    const absTilt = Math.abs(rawTiltDeg);

    if (absTilt <= deadzone) {
      targetTiltSteer = 0;
    } else {
      const norm = Math.min(1.0, (absTilt - deadzone) / (maxTilt - deadzone));
      const progressive = Math.pow(norm, 1.10);
      // Inversión: si invertAccelerometer está activo, derecha es izquierda y viceversa
      const invertFactor = appSettings.invertAccelerometer ? -1 : 1;
      targetTiltSteer = (rawTiltDeg < 0 ? -1 : 1) * progressive * invertFactor;
    }
  }

  function handleDeviceOrientation(ev) {
    if (!ev) return;
    const beta = ev.beta;
    const gamma = ev.gamma;
    if (beta === null && gamma === null) return;

    // Conversión robusta de ángulos Euler al vector de gravedad
    const bRad = (beta || 0) * (Math.PI / 180);
    const gRad = (gamma || 0) * (Math.PI / 180);

    const gx = -9.8 * Math.sin(gRad) * Math.cos(bRad);
    const gy = 9.8 * Math.sin(bRad);
    const gz = 9.8 * Math.cos(gRad) * Math.cos(bRad);

    const tilt = calculateScreenTilt(gx, gy, gz);
    processTiltAngle(tilt);
  }

  function handleDeviceMotion(ev) {
    const g = ev.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null) return;
    const tilt = calculateScreenTilt(g.x, g.y, g.z || 0);
    processTiltAngle(tilt);
  }

  function requestSensorPermissions() {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then((res) => {
        if (res === "granted") accelActive = true;
      }).catch(() => { });
    }
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().catch(() => { });
    }
  }

  window.addEventListener("deviceorientation", handleDeviceOrientation, true);
  window.addEventListener("devicemotion", handleMotionFallback, true);
  function handleMotionFallback(ev) { handleDeviceMotion(ev); }

  function getActiveStageConfig() {
    return STAGE_CONFIG[currentStage] || STAGE_CONFIG.RECON;
  }

  function getActiveDifficultyConfig() {
    return DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.MEDIUM;
  }

  function setupSkyAndLights(rain) {
    if (rain) {
      scene.background = new THREE.Color(0x4E5861);
      scene.fog = new THREE.FogExp2(0x4E5861, 0.0042);
      ambientLight.intensity = 0.72;
      hemiLight.color.setHex(0x8899AA);
      hemiLight.groundColor.setHex(0x2A3228);
      hemiLight.intensity = 0.65;
      sunLight.intensity = 0.78;
      sunLight.color.setHex(0xD0DCE5);
    } else {
      scene.background = new THREE.Color(0x4FA4E8);
      scene.fog = new THREE.FogExp2(0x8EC5F0, 0.0018);
      ambientLight.intensity = 0.68;
      hemiLight.color.setHex(0xBBE2FF);
      hemiLight.groundColor.setHex(0x44622B);
      hemiLight.intensity = 0.75;
      sunLight.intensity = 1.25;
      sunLight.color.setHex(0xFFF6E0);
    }
  }

  function createCompetitorState(racer, gridIndex, isPlayer) {
    const slot = track.gridSlots[gridIndex];
    const kartVisual = window.createKartInstance(racer, { hideNameTag: isPlayer });
    kartVisual.root.position.copy(slot.position);
    kartVisual.root.rotation.y = slot.heading;
    scene.add(kartVisual.root);

    return {
      racer,
      isPlayer,
      gridIndex,
      visual: kartVisual,
      position: slot.position.clone(),
      heading: slot.heading,
      speed: 0,
      steerAngle: 0,
      lateralVel: 0,
      slipAngle: 0,
      accelG: 0,
      trackT: slot.t,
      prevTrackT: slot.t,
      lateralOffset: slot.lateralOffset,
      lap: 1,
      passedHalfway: false,
      finished: false,
      finishTime: 0,
      lapStartTime: 0,
      bestLapTime: null,
      lastLapTime: null,
      totalProgress: -gridIndex * 0.005, // Respeta el orden de parrilla en la largada
      unwrappedS: -gridIndex * 0.005,
      aiTargetOffset: racer.aiLineOffset,
      aiLaneTimer: 1.5 + Math.random() * 3.0,
      aiPaceJitter: 0.985 + Math.random() * 0.035,
      boostEnergy: 100
    };
  }

  function clearKarts() {
    karts.forEach((k) => {
      scene.remove(k.visual.root);
    });
    karts = [];
    playerKart = null;
  }

  function spawnGrid(orderedRacersList) {
    clearKarts();
    const list = orderedRacersList || currentGridOrder || window.RACERS_LIST;
    list.forEach((racer, idx) => {
      const isPlayer = racer.id === selectedRacerId;
      const comp = createCompetitorState(racer, idx, isPlayer);
      karts.push(comp);
      if (isPlayer) {
        playerKart = comp;
      }
    });
  }

  function computeGearAndRpm(speedMps) {
    const absSpd = Math.abs(speedMps);
    const ratios = [0, 6.5, 11.5, 16.2, 20.8, 25.0, 31.0];
    let gear = 1;
    for (let g = 1; g <= 6; g++) {
      if (absSpd >= ratios[g - 1]) gear = g;
    }
    const low = ratios[gear - 1] * 0.75;
    const high = ratios[gear];
    const rpmNorm = THREE.MathUtils.clamp((absSpd - low) / Math.max(1, high - low), 0.22, 0.98);
    return { gear, rpmNorm };
  }

  function formatTime(sec) {
    if (sec === null || sec === undefined || isNaN(sec) || !isFinite(sec)) return "--:--.---";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return (
      String(m).padStart(2, "0") +
      ":" +
      String(s).padStart(2, "0") +
      "." +
      String(ms).padStart(3, "0")
    );
  }

  function lerpAngleShort(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  function applyPacketToKartTarget(k, pkt) {
    if (!k || !pkt) return;
    k.netTarget = pkt;
    k.netLastTime = performance.now();
    k.trackT = pkt.trackT;
    k.lateralOffset = pkt.lateralOffset;
    k.lap = pkt.lap;
    k.passedHalfway = pkt.passedHalfway;
    k.finished = pkt.finished;
    k.finishTime = pkt.finishTime;
    if (pkt.bestLapTime !== null) k.bestLapTime = pkt.bestLapTime;
    if (pkt.lastLapTime !== null) k.lastLapTime = pkt.lastLapTime;
    k.totalProgress = pkt.totalProgress;
  }

  // Actualización física del jugador, sincronización de red P2P e IA competitiva
  function updateKartPhysics(k, dt, canMove) {
    const stageCfg = getActiveStageConfig();
    const totalStageLaps = stageCfg.laps;
    const prevSpeed = k.speed;

    const isOnline = net && net.getMode() !== "OFFLINE";
    const isRemoteSyncedKart =
      !k.isPlayer &&
      isOnline &&
      (net.getMode() === "CLIENT" || net.isRacerHumanControlled(k.racer.id));

    if (isRemoteSyncedKart) {
      // ==================== KART SINCRONIZADO POR RED ONLINE (INTERPOLACIÓN + DEAD RECKONING A 60 FPS) ====================
      if (k.netTarget && canMove) {
        const ageSec = Math.min(0.12, Math.max(0, (performance.now() - (k.netLastTime || performance.now())) / 1000));
        const predX = k.netTarget.x + Math.sin(k.netTarget.heading) * k.netTarget.speed * ageSec;
        const predZ = k.netTarget.z + Math.cos(k.netTarget.heading) * k.netTarget.speed * ageSec;

        k.position.x = THREE.MathUtils.lerp(k.position.x, predX, Math.min(1, dt * 14));
        k.position.z = THREE.MathUtils.lerp(k.position.z, predZ, Math.min(1, dt * 14));
        k.position.y = 0;
        k.heading = lerpAngleShort(k.heading, k.netTarget.heading, Math.min(1, dt * 15));
        k.speed = THREE.MathUtils.lerp(k.speed, k.netTarget.speed, Math.min(1, dt * 12));
        k.steerAngle = THREE.MathUtils.lerp(k.steerAngle, k.netTarget.steerAngle, Math.min(1, dt * 14));
        k.slipAngle = THREE.MathUtils.lerp(k.slipAngle || 0, k.netTarget.slipAngle || 0, Math.min(1, dt * 12));
      }

      k.accelG = (k.speed - prevSpeed) / Math.max(0.001, dt);
      const { gear, rpmNorm } = computeGearAndRpm(k.speed);
      k.visual.root.position.copy(k.position);
      k.visual.root.rotation.y = k.heading;
      k.visual.updateVisuals(dt, {
        speed: k.speed,
        steerAngle: k.steerAngle,
        slipAngle: k.slipAngle || 0,
        accelG: k.accelG,
        rpmNorm,
        gear,
        lapTimeSec: Math.max(0, raceTime - k.lapStartTime),
        isFirstPerson: false
      });
      return;
    }

    if (!k.isPlayer) {
      // ==================== IA COMPETITIVA CON TRAZADA IDEAL (SIN PISAR EL PASTO) ====================
      const diffCfg = getActiveDifficultyConfig();
      const SAFE_ASPHALT_LIMIT = track.trackHalfWidth - 2.35; // ±4.45m (100% dentro de los ±6.8m de asfalto)

      if (canMove && !k.finished) {
        k.aiLaneTimer -= dt;
        if (k.aiLaneTimer <= 0) {
          k.aiLaneTimer = 2.2 + Math.random() * 3.0;
          k.aiPaceJitter = 0.985 + Math.random() * 0.03;
        }

        const curSample = track.getSampleAtT(k.trackT);
        const lookSample = track.getSampleAtT(k.trackT + 0.010);
        const brakeSample = track.getSampleAtT(k.trackT + 0.022);

        // 1. Trazada Ideal precalculada (Exterior -> Ápice -> Exterior) modulada por la Dificultad
        // En rectas mantienen una ligera separación individual; en curvas convergen hacia el ápice óptimo
        const cornerIntensity = THREE.MathUtils.clamp((1.0 - lookSample.speedHint) * 2.2, 0, 1);
        const basePersonalOffset = k.racer.aiLineOffset * 0.55 * (1.0 - cornerIntensity * diffCfg.linePrecision);
        const idealLineOffset = lookSample.optimalOffset * diffCfg.linePrecision + basePersonalOffset;

        // 2. Detección de tráfico adelante para sobrepasar limpiamente por el lado con más asfalto disponible
        let overtakeOffset = 0;
        let blockedSpeedCap = Infinity;

        for (let j = 0; j < karts.length; j++) {
          const other = karts[j];
          if (other === k) continue;
          let dT = other.trackT - k.trackT;
          if (dT < -0.5) dT += 1.0;
          if (dT > 0.5) dT -= 1.0;

          if (dT > 0.001 && dT < 0.024) {
            const latGap = Math.abs(other.lateralOffset - idealLineOffset);
            if (latGap < 1.85) {
              // Elegir el lado hacia el centro del asfalto para jamás salirse al pasto
              const passSide = other.lateralOffset > 0 ? -2.25 : 2.25;
              overtakeOffset = passSide;
              if (dT < 0.008 && Math.abs(other.lateralOffset - k.lateralOffset) < 1.35) {
                blockedSpeedCap = Math.max(10.0, other.speed * 0.96);
              }
            }
          }
        }

        const desiredOffset = THREE.MathUtils.clamp(
          idealLineOffset + overtakeOffset,
          -SAFE_ASPHALT_LIMIT,
          SAFE_ASPHALT_LIMIT
        );

        // 3. Velocidad objetivo según curvatura de la pista y Nivel de Dificultad (Fácil / Medio / Difícil)
        const minHint = Math.min(curSample.speedHint, lookSample.speedHint, brakeSample.speedHint);
        const cornerFactor = (0.46 + minHint * 0.54) * (minHint < 0.85 ? diffCfg.cornerSpeedMult : 1.0);
        const stageFactor = currentStage === "RECON" ? 0.88 : 1.0;
        const rainFactor = isRainMode ? 0.94 : 1.0;

        let targetSpeed =
          MAX_SPEED_MPS *
          cornerFactor *
          diffCfg.paceMult *
          k.racer.aiPace *
          k.aiPaceJitter *
          stageFactor *
          rainFactor;

        targetSpeed = Math.min(targetSpeed, blockedSpeedCap);

        if (k.speed < targetSpeed) {
          k.speed = Math.min(targetSpeed, k.speed + 15.5 * diffCfg.accelMult * dt);
        } else {
          k.speed = Math.max(targetSpeed, k.speed - 23.0 * dt);
        }

        // 4. Movimiento garantizado sobre la cinta asfáltica (imposible cortar por el pasto o atascarse)
        const forwardRatio = THREE.MathUtils.clamp(k.speed / 10.0, 0, 1);
        const prevOffset = k.lateralOffset;
        k.lateralOffset = THREE.MathUtils.lerp(
          k.lateralOffset,
          desiredOffset,
          Math.min(1, dt * diffCfg.overtakeRate * forwardRatio)
        );
        k.lateralOffset = THREE.MathUtils.clamp(k.lateralOffset, -SAFE_ASPHALT_LIMIT, SAFE_ASPHALT_LIMIT);
        const latVel = (k.lateralOffset - prevOffset) / Math.max(0.001, dt);

        // Ajustar longitud de arco efectiva según radio interior/exterior de la curva
        const dS = (k.speed * dt) / Math.max(120, track.totalLength);
        k.prevTrackT = k.trackT;
        k.trackT = (k.trackT + dS) % 1.0;
        k.unwrappedS += dS;

        const newSample = track.getSampleAtT(k.trackT);
        const nextSample = track.getSampleAtT(k.trackT + 0.007);
        k.position.copy(newSample.pt).addScaledVector(newSample.right, k.lateralOffset);
        k.position.y = 0;

        const trackHeading = Math.atan2(newSample.tan.x, newSample.tan.z);
        const nextHeading = Math.atan2(nextSample.tan.x, nextSample.tan.z);
        let curveDelta = nextHeading - trackHeading;
        while (curveDelta > Math.PI) curveDelta -= Math.PI * 2;
        while (curveDelta < -Math.PI) curveDelta += Math.PI * 2;

        const laneAngle = Math.atan2(latVel, Math.max(8.0, k.speed)) * 0.50;
        k.heading = trackHeading - laneAngle;
        k.steerAngle = THREE.MathUtils.clamp(curveDelta * 3.2 - laneAngle * 1.2, -0.42, 0.42);
      } else if (k.finished) {
        k.speed = THREE.MathUtils.lerp(k.speed, 14.0, dt * 2);
        const dS = (k.speed * dt) / Math.max(120, track.totalLength);
        k.prevTrackT = k.trackT;
        k.trackT = (k.trackT + dS) % 1.0;
        const newSample = track.getSampleAtT(k.trackT);
        k.lateralOffset = THREE.MathUtils.clamp(k.lateralOffset, -SAFE_ASPHALT_LIMIT, SAFE_ASPHALT_LIMIT);
        k.position.copy(newSample.pt).addScaledVector(newSample.right, k.lateralOffset);
        k.heading = Math.atan2(newSample.tan.x, newSample.tan.z);
        k.steerAngle = 0;
      }
    } else {
      // ==================== FÍSICA REALISTA DE MANEJO DEL JUGADOR (DIRECCIÓN PROGRESIVA Y DERRAPE POR VELOCIDAD) ====================
      let throttle = 0;
      let brake = 0;
      let rawSteerInput = 0;
      let boosting = false;

      if (canMove && !k.finished) {
        throttle = input.throttle;
        brake = input.brake;
        rawSteerInput = input.left - input.right;
        boosting = input.boost && k.boostEnergy > 5;
      } else if (k.finished) {
        throttle = 0.2;
        brake = k.speed > 12 ? 0.35 : 0;
      }

      const absSpd = Math.abs(k.speed);
      const speedRatio = THREE.MathUtils.clamp(absSpd / MAX_SPEED_MPS, 0, 1.15);

      // 1. Respuesta ágil y directa de la dirección (idéntica y unificada para web y móvil)
      const maxSteerLock = 0.42 * (1.0 - speedRatio * 0.18);
      const sensitivity = typeof appSettings.steerSensitivity === "number" ? appSettings.steerSensitivity : 1.0;
      const targetSteer = rawSteerInput * maxSteerLock * sensitivity;
      const isCentering = Math.abs(targetSteer) < Math.abs(k.steerAngle) && Math.sign(targetSteer || k.steerAngle) === Math.sign(k.steerAngle);
      const steerResponseRate = isCentering ? 6.8 : (5.2 * (1.0 - speedRatio * 0.20));
      k.steerAngle = THREE.MathUtils.lerp(k.steerAngle, targetSteer, Math.min(1, dt * steerResponseRate));

      const trackInfo = track.findClosestTrackPoint(k.position, k.trackT);
      k.prevTrackT = k.trackT;
      k.trackT = trackInfo.t;
      k.lateralOffset = trackInfo.lateralOffset;

      const onGrass = trackInfo.distFromTrackCenter > track.trackHalfWidth + 0.55;
      const onKerb = !onGrass && trackInfo.distFromTrackCenter > track.trackHalfWidth - 0.55;

      const accelPower = boosting ? 21.0 : 15.2;
      const brakePower = 24.5;
      const maxSpd = (boosting ? MAX_SPEED_MPS * 1.12 : MAX_SPEED_MPS) * (onGrass ? 0.68 : 1.0);

      if (boosting) {
        k.boostEnergy = Math.max(0, k.boostEnergy - dt * 30);
      } else {
        k.boostEnergy = Math.min(100, k.boostEnergy + dt * 10);
      }

      if (throttle > 0) {
        const torqueCurve = 1.0 - (k.speed / (maxSpd * 1.15)) * 0.50;
        k.speed += throttle * accelPower * Math.max(0.28, torqueCurve) * dt;
      }
      if (brake > 0) {
        if (k.speed > 0.5) {
          k.speed -= brake * brakePower * dt;
        } else {
          k.speed -= brake * 8.0 * dt;
        }
      }

      const drag = onGrass ? 2.1 : 0.38;
      k.speed -= k.speed * drag * dt;
      k.speed = THREE.MathUtils.clamp(k.speed, -8.0, maxSpd);

      // 2. Dinámica de adherencia y resbalamiento (derrape centrífugo) al doblar demasiado rápido
      const speedFactor = THREE.MathUtils.clamp(absSpd / 3.2, 0, 1);
      const turnDir = k.speed >= -0.1 ? 1 : -1;
      const baseTurnRate = 2.55 * (1.0 - speedRatio * 0.28);
      const requestedOmega = k.steerAngle * baseTurnRate * speedFactor * turnDir;

      // Demanda de fuerza centrípeta lateral vs límite de adherencia de los neumáticos
      const lateralDemand = absSpd * Math.abs(requestedOmega);
      const maxTireGrip = (isRainMode ? 7.4 : 10.6) * (onGrass ? 0.52 : (onKerb ? 0.85 : 1.0));

      let gripEfficiency = 1.0;
      let targetLateralSlide = -k.steerAngle * absSpd * (isRainMode ? 0.14 : 0.06);
      let targetSlipYaw = 0;
      k.slideRatio = 0;

      if (lateralDemand > maxTireGrip) {
        // Exceso de velocidad para el giro realizado: el kart pierde adherencia y se resbala hacia afuera
        const excessGrip = (lateralDemand - maxTireGrip) / maxTireGrip;
        gripEfficiency = 1.0 / (1.0 + excessGrip * 0.72);
        k.slideRatio = THREE.MathUtils.clamp(excessGrip, 0, 1);

        // Fuerza centrífuga que desplaza el kart lateralmente hacia el exterior de la curva
        const slideIntensity = (lateralDemand - maxTireGrip) * (isRainMode ? 0.92 : 0.68);
        targetLateralSlide = -Math.sign(k.steerAngle) * Math.min(11.5, slideIntensity + absSpd * 0.12);

        // Ángulo visual de derrape (sobreviraje/deslizamiento del chasis) y pérdida de velocidad por roce
        targetSlipYaw = k.steerAngle * THREE.MathUtils.clamp(excessGrip * 0.55, 0, 0.28) * turnDir;
        k.speed *= Math.max(0.92, 1.0 - excessGrip * 0.16 * dt);
      }

      k.heading += requestedOmega * gripEfficiency * dt;

      // Inercia del deslizamiento lateral (en lluvia o pasto tarda más en recuperar la tracción)
      const slideResponsiveness = lateralDemand > maxTireGrip
        ? (isRainMode ? 3.8 : 4.6)
        : (isRainMode ? 2.6 : 5.5) * (onGrass ? 0.6 : 1.0);

      k.lateralVel = THREE.MathUtils.lerp(k.lateralVel, targetLateralSlide, Math.min(1, dt * slideResponsiveness));
      k.slipAngle = THREE.MathUtils.lerp(k.slipAngle || 0, targetSlipYaw, Math.min(1, dt * 7.5));

      const fwdX = Math.sin(k.heading);
      const fwdZ = Math.cos(k.heading);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      k.position.x += (fwdX * k.speed + rightX * k.lateralVel) * dt;
      k.position.z += (fwdZ * k.speed + rightZ * k.lateralVel) * dt;
      k.position.y = onKerb ? Math.sin(raceTime * 48) * 0.016 : 0;

      const maxOffTrack = track.trackHalfWidth + 3.0;
      if (Math.abs(trackInfo.lateralOffset) > maxOffTrack) {
        const sign = Math.sign(trackInfo.lateralOffset);
        const clampedPt = trackInfo.sample.pt.clone().addScaledVector(trackInfo.sample.right, sign * maxOffTrack);
        k.position.x = THREE.MathUtils.lerp(k.position.x, clampedPt.x, 0.35);
        k.position.z = THREE.MathUtils.lerp(k.position.z, clampedPt.z, 0.35);
        k.speed *= 0.94;
      }
    }

    // ==================== DETECCIÓN DE VUELTAS Y TIEMPOS DE CLASIFICACIÓN ====================
    const startT = track.startT;
    const halfT = (startT + 0.5) % 1.0;

    if (Math.abs(k.trackT - halfT) < 0.09) {
      k.passedHalfway = true;
    }

    if (
      canMove &&
      k.passedHalfway &&
      k.prevTrackT < startT &&
      k.trackT >= startT &&
      Math.abs(k.trackT - k.prevTrackT) < 0.25
    ) {
      k.passedHalfway = false;
      const rawLapSec = raceTime - k.lapStartTime;
      // Para la IA en clasificación, añadimos micro-variación realista sobre su tiempo real de vuelta
      const lapDuration = k.isPlayer ? rawLapSec : rawLapSec * (0.985 + Math.random() * 0.03);

      if (lapDuration > 6) {
        k.lastLapTime = lapDuration;
        if (k.bestLapTime === null || lapDuration < k.bestLapTime) {
          k.bestLapTime = lapDuration;
        }
      }
      k.lapStartTime = raceTime;

      if (k.lap >= totalStageLaps) {
        if (!k.finished) {
          k.finished = true;
          k.finishTime = raceTime;
          if (k.isPlayer) {
            onStageComplete();
          }
        }
      } else {
        k.lap++;
        if (k.isPlayer && audio) {
          audio.playBeep(880, 0.18);
        }
      }
    }

    const relT = ((k.trackT - startT) + 1.0) % 1.0;
    const adjustedRelT = (!k.passedHalfway && relT > 0.78) ? (relT - 1.0) : relT;
    k.totalProgress = (k.lap - 1) + adjustedRelT;

    k.accelG = (k.speed - prevSpeed) / Math.max(0.001, dt);
    const { gear, rpmNorm } = computeGearAndRpm(k.speed);

    k.visual.root.position.copy(k.position);
    k.visual.root.rotation.y = k.heading;

    k.visual.updateVisuals(dt, {
      speed: k.speed,
      steerAngle: k.steerAngle,
      slipAngle: k.slipAngle || 0,
      accelG: k.accelG,
      rpmNorm,
      gear,
      lapTimeSec: Math.max(0, raceTime - k.lapStartTime),
      isFirstPerson: k.isPlayer && cameraMode === "COCKPIT" && gameState !== "MENU"
    });
  }

  // Colisiones rueda a rueda manteniendo a los bots siempre dentro del asfalto
  function resolveKartCollisions() {
    const minDist = 1.55;
    const SAFE_ASPHALT_LIMIT = track.trackHalfWidth - 2.35;
    for (let i = 0; i < karts.length; i++) {
      for (let j = i + 1; j < karts.length; j++) {
        const a = karts[i];
        const b = karts[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > 0.0001 && distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;

          if (a.isPlayer) {
            a.position.x -= nx * overlap;
            a.position.z -= nz * overlap;
          } else {
            const sA = track.getSampleAtT(a.trackT);
            const pushA = -(nx * sA.right.x + nz * sA.right.z) * overlap * 0.5;
            a.lateralOffset = THREE.MathUtils.clamp(a.lateralOffset + pushA, -SAFE_ASPHALT_LIMIT, SAFE_ASPHALT_LIMIT);
            a.position.copy(sA.pt).addScaledVector(sA.right, a.lateralOffset);
            a.visual.root.position.copy(a.position);
          }

          if (b.isPlayer) {
            b.position.x += nx * overlap;
            b.position.z += nz * overlap;
          } else {
            const sB = track.getSampleAtT(b.trackT);
            const pushB = (nx * sB.right.x + nz * sB.right.z) * overlap * 0.5;
            b.lateralOffset = THREE.MathUtils.clamp(b.lateralOffset + pushB, -SAFE_ASPHALT_LIMIT, SAFE_ASPHALT_LIMIT);
            b.position.copy(sB.pt).addScaledVector(sB.right, b.lateralOffset);
            b.visual.root.position.copy(b.position);
          }

          const avgSpd = (a.speed + b.speed) * 0.5;
          a.speed = THREE.MathUtils.lerp(a.speed, avgSpd, 0.18);
          b.speed = THREE.MathUtils.lerp(b.speed, avgSpd, 0.18);
        }
      }
    }
  }

  // Ordena a los corredores según la etapa actual:
  // En CLASIFICACIÓN (QUALY) se ordenan por Mejor Tiempo de Vuelta (bestLapTime);
  // En RECONOCIMIENTO y CARRERA FINAL (RACE) se ordenan por posición física en pista (totalProgress).
  function getSortedStandings() {
    return karts.slice().sort((a, b) => {
      if (currentStage === "QUALY") {
        const ta = a.bestLapTime !== null ? a.bestLapTime : Infinity;
        const tb = b.bestLapTime !== null ? b.bestLapTime : Infinity;
        if (ta !== tb) return ta - tb;
        return b.totalProgress - a.totalProgress;
      } else {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.totalProgress - a.totalProgress;
      }
    });
  }

  // Asegura que todos los corredores IA tengan un tiempo de clasificación válido acorde a la Dificultad elegida
  function ensureAllQualyTimes() {
    const diffCfg = getActiveDifficultyConfig();
    const baseRefLap = diffCfg.qualyBaseSec * (isRainMode ? 1.06 : 1.0);
    karts.forEach((k) => {
      if (k.bestLapTime === null) {
        if (k.isPlayer) {
          const curLapElapsed = Math.max(28.0, raceTime - k.lapStartTime);
          k.bestLapTime = curLapElapsed > 30 ? curLapElapsed : baseRefLap * 1.01;
        } else {
          const paceFactor = 2.0 - k.racer.aiPace;
          k.bestLapTime = baseRefLap * paceFactor * (0.985 + Math.random() * 0.03);
        }
      }
    });
  }

  // Renderizador seguro de filas de tabla (DOM API pura sin innerHTML para evitar XSS)
  function populateStandingsTableSafe(tbody, list, getPosLabel, getTimeNodes) {
    if (!tbody) return;
    tbody.textContent = "";
    list.forEach((k, idx) => {
      const tr = document.createElement("tr");
      if (k.isPlayer) tr.className = "finish-row-player";

      const tdPos = document.createElement("td");
      const strongPos = document.createElement("strong");
      strongPos.textContent = getPosLabel(idx);
      tdPos.appendChild(strongPos);

      const tdRacer = document.createElement("td");
      const dot = document.createElement("span");
      dot.className = "lb-color-dot";
      dot.style.background = safeHexColor(k.racer.primaryColor);
      dot.style.display = "inline-block";
      dot.style.verticalAlign = "middle";
      dot.style.marginRight = "6px";
      const strongName = document.createElement("strong");
      strongName.textContent = "#" + Number(k.racer.number) + " " + String(k.racer.name);
      tdRacer.appendChild(dot);
      tdRacer.appendChild(strongName);

      const tdTime = document.createElement("td");
      getTimeNodes(tdTime, k, idx);

      tr.appendChild(tdPos);
      tr.appendChild(tdRacer);
      tr.appendChild(tdTime);
      tbody.appendChild(tr);
    });
  }

  // Transición al terminar cada una de las 3 Etapas (Reconocimiento -> Clasificación -> Carrera Final 30 vueltas)
  function onStageComplete() {
    const modal = document.getElementById("finish-modal");
    const tbody = document.getElementById("finish-standings-body");
    const badgeEl = document.getElementById("finish-stage-badge");
    const title = document.getElementById("finish-title");
    const subtitle = document.getElementById("finish-subtitle");
    const colTimeHeader = document.getElementById("finish-col-time");
    const btnNextStage = document.getElementById("btn-next-stage");

    if (currentStage === "RECON") {
      gameState = "STAGE_COMPLETE";
      const sorted = getSortedStandings();

      if (badgeEl) badgeEl.textContent = "Etapa 1/3 Completada • Reconocimiento";
      if (title) title.textContent = "¡VUELTA DE RECONOCIMIENTO FINALIZADA!";
      if (subtitle) {
        subtitle.textContent =
          "Pista reconocida. A continuación se disputarán las 3 Vueltas de Clasificación para ordenar la grilla de largada.";
      }
      if (colTimeHeader) colTimeHeader.textContent = "Vuelta Recon.";

      populateStandingsTableSafe(
        tbody,
        sorted,
        (idx) => (idx + 1) + "°",
        (tdTime, k) => {
          tdTime.textContent = k.lastLapTime ? formatTime(k.lastLapTime) : "En Pista";
        }
      );

      if (btnNextStage) {
        btnNextStage.classList.remove("hidden");
        btnNextStage.textContent = "⏱️ INICIAR CLASIFICACIÓN (3 VUELTAS) ▶";
      }
      if (modal) modal.classList.remove("hidden");
    } else if (currentStage === "QUALY") {
      gameState = "STAGE_COMPLETE";
      ensureAllQualyTimes();

      // Ordenar a los 8 corredores por su Mejor Tiempo de Clasificación (de menor a mayor)
      const qualySorted = karts.slice().sort((a, b) => a.bestLapTime - b.bestLapTime);

      // ACTUALIZAR EL ORDEN DE PARRILLA OFICIAL PARA LA CARRERA DE 30 VUELTAS
      currentGridOrder = qualySorted.map((k) => k.racer);

      const playerPoleRank = qualySorted.indexOf(playerKart) + 1;
      const poleTime = qualySorted[0].bestLapTime;

      if (badgeEl) badgeEl.textContent = "Etapa 2/3 Completada • Parrilla de Largada Oficial";
      if (title) {
        title.textContent =
          playerPoleRank === 1
            ? `¡POLE POSITION PARA ${playerKart.racer.name.toUpperCase()}!`
            : `CLASIFICACIÓN TERMINADA • LARGAS ${playerPoleRank}°`;
      }
      if (subtitle) {
        subtitle.textContent =
          `Los 8 corredores han sido ordenados por su mejor tiempo de clasificación para largar la Carrera Final de ${STAGE_CONFIG.RACE.laps} Vueltas:`;
      }
      if (colTimeHeader) colTimeHeader.textContent = "Mejor Vuelta (Dif.)";

      populateStandingsTableSafe(
        tbody,
        qualySorted,
        (idx) => "Cajón " + (idx + 1) + "°",
        (tdTime, k, idx) => {
          const diff = idx === 0 ? "POLE" : "+" + (k.bestLapTime - poleTime).toFixed(3) + "s";
          tdTime.appendChild(document.createTextNode(formatTime(k.bestLapTime) + " "));
          const diffSpan = document.createElement("span");
          diffSpan.style.color = "#94A3B8";
          diffSpan.style.fontSize = "12px";
          diffSpan.textContent = "(" + diff + ")";
          tdTime.appendChild(diffSpan);
        }
      );

      if (btnNextStage) {
        btnNextStage.classList.remove("hidden");
        btnNextStage.textContent = `🏁 LARGAR CARRERA FINAL (${STAGE_CONFIG.RACE.laps} VUELTAS) ▶`;
      }
      if (modal) modal.classList.remove("hidden");
    } else {
      // Final de la Carrera Final
      gameState = "FINISHED";
      const sorted = getSortedStandings();
      const playerRank = sorted.indexOf(playerKart) + 1;

      if (badgeEl) badgeEl.textContent = `Etapa 3/3 Completada • Carrera Final (${STAGE_CONFIG.RACE.laps} Vueltas)`;
      if (title) {
        title.textContent =
          playerRank === 1
            ? `🏆 ¡VICTORIA DE ${playerKart.racer.name.toUpperCase()} EN BUENOS AIRES!`
            : `🏁 ¡CARRERA FINALIZADA! PUESTO ${playerRank}°`;
      }
      if (subtitle) {
        subtitle.textContent = `Resultado oficial tras las ${STAGE_CONFIG.RACE.laps} vueltas al Kartódromo Ciudad de Buenos Aires:`;
      }
      if (colTimeHeader) colTimeHeader.textContent = "Tiempo Total";

      populateStandingsTableSafe(
        tbody,
        sorted,
        (idx) => (idx + 1) + "°",
        (tdTime, k, idx) => {
          tdTime.textContent = k.finished ? formatTime(k.finishTime) : formatTime(raceTime + idx * 1.6);
        }
      );

      if (btnNextStage) {
        btnNextStage.classList.add("hidden");
      }
      if (modal) modal.classList.remove("hidden");
    }

    // Si somos el Anfitrión (HOST) en una sala online, sincronizar el fin de etapa y el orden de parrilla con todos los clientes
    if (net && net.getMode() === "HOST") {
      net.notifyHostStageComplete({
        stage: currentStage,
        gridOrderIds: currentGridOrder.map((r) => r.id)
      });
    }
  }

  const smoothCamPos = new THREE.Vector3();
  const smoothCamLook = new THREE.Vector3();
  let camInitialized = false;

  function updateCamera(dt) {
    if (!playerKart) return;

    if (gameState === "MENU") {
      const angle = performance.now() * 0.00055;
      const kp = playerKart.position;
      const radius = 2.85;
      camera.position.set(
        kp.x + Math.sin(angle) * radius,
        kp.y + 1.15,
        kp.z + Math.cos(angle) * radius
      );
      camera.lookAt(kp.x, kp.y + 0.48, kp.z);
      camInitialized = false;
      return;
    }

    const fwdX = Math.sin(playerKart.heading);
    const fwdZ = Math.cos(playerKart.heading);
    const rightX = -fwdZ;
    const rightZ = fwdX;

    if (cameraMode === "COCKPIT") {
      const headSway = playerKart.steerAngle * 0.08;
      const headBob = Math.sin(raceTime * 22) * Math.min(0.005, Math.abs(playerKart.speed) * 0.00022);

      const eyeX = playerKart.position.x + fwdX * (-0.15) + rightX * headSway;
      const eyeY = playerKart.position.y + 0.88 + headBob;
      const eyeZ = playerKart.position.z + fwdZ * (-0.15) + rightZ * headSway;

      camera.position.set(eyeX, eyeY, eyeZ);

      const lookX = playerKart.position.x + fwdX * 5.8 + rightX * (playerKart.steerAngle * 1.4);
      const lookY = playerKart.position.y + 0.22;
      const lookZ = playerKart.position.z + fwdZ * 5.8 + rightZ * (playerKart.steerAngle * 1.4);

      camera.up.set(0, 1, 0);
      camera.lookAt(lookX, lookY, lookZ);
      camInitialized = false;
    } else {
      const distBack = 3.55;
      const heightUp = 1.62;
      const targetPos = new THREE.Vector3(
        playerKart.position.x - fwdX * distBack + rightX * (playerKart.steerAngle * 0.45),
        playerKart.position.y + heightUp,
        playerKart.position.z - fwdZ * distBack + rightZ * (playerKart.steerAngle * 0.45)
      );
      const targetLook = new THREE.Vector3(
        playerKart.position.x + fwdX * 3.8,
        playerKart.position.y + 0.65,
        playerKart.position.z + fwdZ * 3.8
      );

      if (!camInitialized) {
        smoothCamPos.copy(targetPos);
        smoothCamLook.copy(targetLook);
        camInitialized = true;
      } else {
        smoothCamPos.lerp(targetPos, Math.min(1, dt * 11));
        smoothCamLook.lerp(targetLook, Math.min(1, dt * 14));
      }
      camera.position.copy(smoothCamPos);
      camera.lookAt(smoothCamLook);
    }
  }

  let minimapCanvas, minimapCtx;
  function renderMinimap() {
    if (!minimapCanvas || !track) return;
    const ctx = minimapCtx;
    const W = minimapCanvas.width;
    const H = minimapCanvas.height;

    ctx.clearRect(0, 0, W, H);

    const sx = W / 1600;
    const sy = H / 1037;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    window.TRACK_PIXEL_POINTS.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.px * sx, p.py * sy);
      else ctx.lineTo(p.px * sx, p.py * sy);
    });
    ctx.closePath();

    ctx.strokeStyle = "rgba(15, 20, 28, 0.9)";
    ctx.lineWidth = 11;
    ctx.stroke();

    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 6;
    ctx.stroke();

    const sp = window.TRACK_PIXEL_POINTS[1];
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(sp.px * sx - 2, sp.py * sy - 7, 5, 14);

    ctx.fillStyle = "#94A3B8";
    ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    window.TRACK_CORNER_LABELS.forEach((cl) => {
      ctx.fillText(String(cl.num), cl.px * sx, cl.py * sy);
    });

    karts.forEach((k) => {
      const pix = track.worldToPixel(k.position.x, k.position.z);
      const px = pix.px * sx;
      const py = pix.py * sy;

      ctx.beginPath();
      ctx.arc(px, py, k.isPlayer ? 6.2 : 4.4, 0, Math.PI * 2);
      ctx.fillStyle = k.racer.primaryColor;
      ctx.fill();
      ctx.lineWidth = k.isPlayer ? 2.5 : 1.5;
      ctx.strokeStyle = k.isPlayer ? "#FFFFFF" : "#111827";
      ctx.stroke();
    });

    ctx.restore();
  }

  function updateHUD() {
    if (!playerKart) return;

    const stageCfg = getActiveStageConfig();
    const totalStageLaps = stageCfg.laps;
    const sorted = getSortedStandings();

    const playerRank = sorted.indexOf(playerKart) + 1;
    const speedKmh = Math.round(Math.abs(playerKart.speed) * 3.6);
    const { gear, rpmNorm } = computeGearAndRpm(playerKart.speed);

    const elStageBanner = document.getElementById("hud-stage-banner");
    const elSpeed = document.getElementById("hud-speed");
    const elGear = document.getElementById("hud-gear");
    const elPos = document.getElementById("hud-pos");
    const elLap = document.getElementById("hud-lap");
    const elTime = document.getElementById("hud-time");
    const elRpmBar = document.getElementById("hud-rpm-fill");
    const elBoostBar = document.getElementById("hud-boost-fill");
    const elWheelIcon = document.getElementById("ui-steering-wheel");
    const elLbRightCol = document.getElementById("lb-col-right");

    if (elStageBanner) elStageBanner.textContent = stageCfg.title;
    if (elSpeed) elSpeed.textContent = speedKmh;
    if (elGear) elGear.textContent = "M" + gear;
    if (elPos) elPos.textContent = playerRank + "° / 8";
    if (elLap) elLap.textContent = Math.min(playerKart.lap, totalStageLaps) + " / " + totalStageLaps;
    if (elTime) elTime.textContent = formatTime(raceTime - playerKart.lapStartTime);
    if (elRpmBar) elRpmBar.style.width = Math.round(rpmNorm * 100) + "%";
    if (elBoostBar) elBoostBar.style.width = Math.round(playerKart.boostEnergy) + "%";
    if (elLbRightCol) elLbRightCol.textContent = currentStage === "QUALY" ? "Mejor" : "Vuelta";

    if (elWheelIcon) {
      const deg = -playerKart.steerAngle * 155;
      elWheelIcon.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    }

    const elTiltText = document.getElementById("accel-tilt-text");
    const elTiltBadge = document.getElementById("accel-tilt-badge");
    if (elTiltText && elTiltBadge) {
      const deg = Math.round(rawTiltDeg);
      const isInv = appSettings.invertAccelerometer;
      if (Math.abs(deg) <= 1) {
        elTiltText.textContent = "● CENTRADO";
        elTiltBadge.classList.remove("tilting-left", "tilting-right");
      } else if (deg < -1) {
        const effectiveTurnLeft = !isInv;
        elTiltText.textContent = isInv ? `DER [INV] ${Math.abs(deg)}° ▶` : `◀ ${Math.abs(deg)}° IZQ`;
        elTiltBadge.classList.toggle("tilting-left", effectiveTurnLeft);
        elTiltBadge.classList.toggle("tilting-right", !effectiveTurnLeft);
      } else {
        const effectiveTurnLeft = isInv;
        elTiltText.textContent = isInv ? `◀ IZQ [INV] ${Math.abs(deg)}°` : `DER ${Math.abs(deg)}° ▶`;
        elTiltBadge.classList.toggle("tilting-left", effectiveTurnLeft);
        elTiltBadge.classList.toggle("tilting-right", !effectiveTurnLeft);
      }
    }

    const elJoystickSphere = document.getElementById("steer-joystick-sphere");
    if (elJoystickSphere && !elJoystickSphere.classList.contains("active")) {
      const joyOffsetPx = (-playerKart.steerAngle / 0.33) * 62;
      elJoystickSphere.style.transform = `translate(${joyOffsetPx.toFixed(1)}px, 0px)`;
    }

    const lbContainer = document.getElementById("leaderboard-rows");
    if (lbContainer) {
      lbContainer.textContent = "";
      sorted.forEach((k, idx) => {
        const isMe = k.isPlayer;
        let rightInfo = "V" + Math.min(k.lap, totalStageLaps);
        if (currentStage === "QUALY") {
          rightInfo = k.bestLapTime !== null ? k.bestLapTime.toFixed(2) + "s" : "V" + k.lap;
        }
        const row = document.createElement("div");
        row.className = "lb-row" + (isMe ? " lb-player" : "");

        const rankSpan = document.createElement("span");
        rankSpan.className = "lb-rank";
        rankSpan.textContent = (idx + 1) + "°";

        const dotSpan = document.createElement("span");
        dotSpan.className = "lb-color-dot";
        dotSpan.style.background = safeHexColor(k.racer.primaryColor);
        dotSpan.style.borderColor = safeHexColor(k.racer.secondaryColor);

        const numSpan = document.createElement("span");
        numSpan.className = "lb-num";
        numSpan.textContent = "#" + Number(k.racer.number);

        const nameSpan = document.createElement("span");
        nameSpan.className = "lb-name";
        nameSpan.textContent = String(k.racer.name);

        const lapSpan = document.createElement("span");
        lapSpan.className = "lb-lap";
        lapSpan.textContent = rightInfo;

        row.appendChild(rankSpan);
        row.appendChild(dotSpan);
        row.appendChild(numSpan);
        row.appendChild(nameSpan);
        row.appendChild(lapSpan);
        lbContainer.appendChild(row);
      });
    }

    renderMinimap();
  }

  function buildRacerCardsUI() {
    const gridEl = document.getElementById("racer-selector-grid");
    if (!gridEl) return;

    const isOnline = Boolean(net && net.getMode() !== "OFFLINE");

    gridEl.textContent = "";
    window.RACERS_LIST.forEach((r) => {
      const isTakenByOther = isOnline && net.isRacerClaimedByOther(r.id);
      const isMine = r.id === selectedRacerId;

      const btn = document.createElement("button");
      btn.className =
        "racer-card" +
        (isMine ? " active" : "") +
        (isTakenByOther ? " racer-card-locked" : "");
      btn.setAttribute("data-racer-id", String(r.id));
      if (isTakenByOther) {
        btn.disabled = true;
        btn.title = "Este corredor ya fue elegido por otro jugador en la sala";
      }

      const swatch = document.createElement("div");
      swatch.className = "racer-swatch";
      const c1 = safeHexColor(r.primaryColor);
      const c2 = safeHexColor(r.secondaryColor);
      const c3 = safeHexColor(r.stripeColor);
      swatch.style.background = `linear-gradient(135deg, ${c1} 55%, ${c2} 55%, ${c2} 80%, ${c3} 80%)`;

      const numSpan = document.createElement("span");
      numSpan.className = "racer-number";
      numSpan.textContent = "#" + Number(r.number);
      swatch.appendChild(numSpan);

      const info = document.createElement("div");
      info.className = "racer-info";

      const titleDiv = document.createElement("div");
      titleDiv.className = "racer-title";
      titleDiv.appendChild(document.createTextNode(String(r.rawName)));

      if (isOnline) {
        const badge = document.createElement("span");
        if (isTakenByOther) {
          badge.className = "racer-status-badge badge-taken";
          badge.textContent = "🔒 OCUPADO";
        } else if (isMine) {
          badge.className = "racer-status-badge badge-mine";
          badge.textContent = "👤 TUYO";
        } else {
          badge.className = "racer-status-badge badge-free";
          badge.textContent = "🟢 LIBRE";
        }
        titleDiv.appendChild(badge);
      }

      const subDiv = document.createElement("div");
      subDiv.className = "racer-sub";
      subDiv.textContent = isTakenByOther
        ? "No disponible (en uso)"
        : "Kart #" + Number(r.number) + " • " + String(r.name);

      info.appendChild(titleDiv);
      info.appendChild(subDiv);

      btn.appendChild(swatch);
      btn.appendChild(info);

      btn.addEventListener("click", () => {
        if (isOnline) {
          if (net.isRacerClaimedByOther(r.id)) return;
          net.requestClaimRacer(r.id);
        } else {
          selectedRacerId = r.id;
          buildRacerCardsUI();
          currentGridOrder = window.RACERS_LIST.slice();
          spawnGrid(currentGridOrder);
        }
      });

      gridEl.appendChild(btn);
    });
  }

  function startStageSession(stageId, isRemoteTrigger) {
    if (net && net.getMode() === "CLIENT" && !isRemoteTrigger) {
      const statusEl = document.getElementById("online-status-text");
      if (statusEl) {
        statusEl.textContent = "⏳ Esperando a que el Anfitrión de la sala inicie la etapa...";
      }
      return;
    }

    if (audio) {
      audio.init();
      audio.setMuted(!appSettings.audioEnabled);
    }
    requestSensorPermissions();
    currentStage = stageId || "RECON";

    // En dispositivos móviles táctiles, pasar automáticamente a pantalla completa al salir a pista
    if (!isRemoteTrigger && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      const docEl = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(docEl))
            .then(() => {
              if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock("landscape").catch(() => { });
              }
            })
            .catch(() => { });
        }
      }
    }

    // Si comenzamos Reconocimiento desde el menú, orden inicial 1 al 8 (con el jugador en su puesto original)
    if (currentStage === "RECON" && !isRemoteTrigger) {
      currentGridOrder = window.RACERS_LIST.slice();
    }

    if (net && net.getMode() === "HOST") {
      net.notifyHostStartStage(
        currentStage,
        currentDifficulty,
        isRainMode,
        currentGridOrder.map((r) => r.id)
      );
    }

    const menuEl = document.getElementById("start-menu");
    const finishEl = document.getElementById("finish-modal");
    const pauseEl = document.getElementById("pause-modal");
    const hudEl = document.getElementById("race-hud");
    if (menuEl) menuEl.classList.add("hidden");
    if (finishEl) finishEl.classList.add("hidden");
    if (pauseEl) pauseEl.classList.add("hidden");
    if (hudEl) hudEl.classList.remove("hidden");

    spawnGrid(currentGridOrder);
    raceTime = 0;
    countdownTimer = 3.4;
    lastBeepSec = -1;
    gameState = "COUNTDOWN";

    const lightsEl = document.getElementById("start-lights");
    if (lightsEl) lightsEl.classList.remove("hidden");
  }

  function toggleCameraMode() {
    cameraMode = cameraMode === "COCKPIT" ? "CHASE" : "COCKPIT";
    const btnCam = document.getElementById("btn-camera-label");
    if (btnCam) {
      btnCam.textContent = cameraMode === "COCKPIT" ? "Cámara: Cockpit (1ªP)" : "Cámara: Exterior (3ªP)";
    }
  }

  function toggleWeatherMode(forceRain) {
    isRainMode = typeof forceRain === "boolean" ? forceRain : !isRainMode;
    appSettings.rainMode = isRainMode;
    saveSettings();
    setupSkyAndLights(isRainMode);
    if (track) track.setWeatherMode(isRainMode);
    if (weather) weather.setRainMode(isRainMode);

    const btnWeather = document.getElementById("btn-weather-label");
    if (btnWeather) {
      btnWeather.textContent = isRainMode ? "Clima: Lluvia (Mojado)" : "Clima: Soleado (Seco)";
    }
    document.querySelectorAll(".weather-pill, .setting-weather-pill").forEach((el) => {
      const val = el.getAttribute("data-rain") === "true";
      el.classList.toggle("active", val === isRainMode);
    });
  }

  function togglePauseRace() {
    const pauseEl = document.getElementById("pause-modal");
    const pauseInfo = document.getElementById("pause-stage-info");
    if (gameState === "RACING" || gameState === "COUNTDOWN") {
      stateBeforePause = gameState;
      gameState = "PAUSED";
      if (pauseInfo) {
        pauseInfo.textContent = getActiveStageConfig().title + " • Dificultad: " + getActiveDifficultyConfig().label;
      }
      if (pauseEl) pauseEl.classList.remove("hidden");
    } else if (gameState === "PAUSED") {
      gameState = stateBeforePause || "RACING";
      if (pauseEl) pauseEl.classList.add("hidden");
    }
  }

  function exitToMainMenu() {
    gameState = "MENU";
    const finishEl = document.getElementById("finish-modal");
    const pauseEl = document.getElementById("pause-modal");
    const hudEl = document.getElementById("race-hud");
    const menuEl = document.getElementById("start-menu");
    if (finishEl) finishEl.classList.add("hidden");
    if (pauseEl) pauseEl.classList.add("hidden");
    if (hudEl) hudEl.classList.add("hidden");
    if (menuEl) menuEl.classList.remove("hidden");
    currentGridOrder = window.RACERS_LIST.slice();
    spawnGrid(currentGridOrder);
  }

  function bindControls() {
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (e.code === "KeyP" || e.code === "Escape") {
        if (gameState === "RACING" || gameState === "COUNTDOWN" || gameState === "PAUSED") {
          togglePauseRace();
          return;
        }
      }
      if (e.code === "KeyC") toggleCameraMode();
      if (e.code === "KeyR" && (gameState === "RACING" || gameState === "FINISHED")) {
        startStageSession(currentStage);
      }
      if (e.code === "KeyV") toggleWeatherMode();
      updateKeyboardInput();
    });

    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
      updateKeyboardInput();
    });

    function updateKeyboardInput() {
      input.throttle = keys["KeyW"] || keys["ArrowUp"] ? 1 : 0;
      input.brake = keys["KeyS"] || keys["ArrowDown"] ? 1 : 0;
      input.left = keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0;
      input.right = keys["KeyD"] || keys["ArrowRight"] ? 1 : 0;
      input.boost = Boolean(keys["Space"] || keys["ShiftLeft"]);
    }

    function bindHoldButton(id, onDown, onUp) {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (ev) => { ev.preventDefault(); onDown(); };
      const end = (ev) => { ev.preventDefault(); onUp(); };
      el.addEventListener("mousedown", start);
      el.addEventListener("mouseup", end);
      el.addEventListener("mouseleave", end);
      el.addEventListener("touchstart", start, { passive: false });
      el.addEventListener("touchend", end, { passive: false });
      el.addEventListener("touchcancel", end, { passive: false });
    }

    bindHoldButton("pedal-gas", () => { input.throttle = 1; }, () => { input.throttle = 0; });
    bindHoldButton("pedal-brake", () => { input.brake = 1; }, () => { input.brake = 0; });
    bindHoldButton("btn-boost", () => { input.boost = true; }, () => { input.boost = false; });

    // ==================== JOYSTICK CON ESFERA TÁCTIL PARA GIRAR A IZQUIERDA O DERECHA ====================
    const joyBase = document.getElementById("steer-joystick-base");
    const joySphere = document.getElementById("steer-joystick-sphere");
    if (joyBase && joySphere) {
      let joyTouchId = null;
      let joyMouseDown = false;

      const updateJoystickPosition = (clientX, clientY) => {
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        const knobWidth = joySphere.offsetWidth || 60;
        const maxRadius = Math.max(30, (rect.width - knobWidth) * 0.5 - 4);

        let rawDx = clientX - centerX;
        let rawDy = clientY - centerY;
        const dist = Math.hypot(rawDx, rawDy);
        if (dist > maxRadius && dist > 0) {
          rawDx = (rawDx / dist) * maxRadius;
          rawDy = (rawDy / dist) * maxRadius;
        }

        joySphere.style.transform = `translate(${rawDx.toFixed(1)}px, ${rawDy.toFixed(1)}px)`;

        // Calibración analógica realista y suave (no hiper-sensible)
        const normX = THREE.MathUtils.clamp(rawDx / maxRadius, -1, 1);
        const deadzone = 0.06;
        const absNorm = Math.abs(normX);
        if (absNorm <= deadzone) {
          input.left = 0;
          input.right = 0;
        } else {
          const rescaled = (absNorm - deadzone) / (1.0 - deadzone);
          // Curva de aceleración analógica con progresión suave:
          // Permite micro-ajustes estables en rectas y entrega 100% de giro solo al borde
          const progressiveSteer = Math.min(1.0, Math.pow(rescaled, 1.40));
          if (normX < 0) {
            input.left = progressiveSteer;
            input.right = 0;
          } else {
            input.right = progressiveSteer;
            input.left = 0;
          }
        }
      };

      const resetJoystick = () => {
        joyTouchId = null;
        joyMouseDown = false;
        joySphere.classList.remove("active");
        joySphere.style.transform = "translate(0px, 0px)";
        input.left = 0;
        input.right = 0;
      };

      joyBase.addEventListener("touchstart", (ev) => {
        ev.preventDefault();
        if (ev.changedTouches.length > 0) {
          const t = ev.changedTouches[0];
          joyTouchId = t.identifier;
          joySphere.classList.add("active");
          updateJoystickPosition(t.clientX, t.clientY);
        }
      }, { passive: false });

      joyBase.addEventListener("touchmove", (ev) => {
        ev.preventDefault();
        for (let i = 0; i < ev.touches.length; i++) {
          if (ev.touches[i].identifier === joyTouchId) {
            updateJoystickPosition(ev.touches[i].clientX, ev.touches[i].clientY);
            break;
          }
        }
      }, { passive: false });

      joyBase.addEventListener("touchend", (ev) => {
        ev.preventDefault();
        for (let i = 0; i < ev.changedTouches.length; i++) {
          if (ev.changedTouches[i].identifier === joyTouchId) {
            resetJoystick();
            break;
          }
        }
      }, { passive: false });

      joyBase.addEventListener("touchcancel", (ev) => {
        ev.preventDefault();
        resetJoystick();
      }, { passive: false });

      joyBase.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        joyMouseDown = true;
        joySphere.classList.add("active");
        updateJoystickPosition(ev.clientX, ev.clientY);
      });

      window.addEventListener("mousemove", (ev) => {
        if (!joyMouseDown) return;
        updateJoystickPosition(ev.clientX, ev.clientY);
      });

      window.addEventListener("mouseup", () => {
        if (joyMouseDown) {
          resetJoystick();
        }
      });
    }

    // Soporte táctil adicional sobre el aro del volante virtual
    const wheelEl = document.getElementById("ui-steering-wheel");
    if (wheelEl) {
      let wheelTouchId = null;
      const updateWheelTouch = (clientX) => {
        const isMobile = isMobilePlatform();
        const rect = wheelEl.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const normX = THREE.MathUtils.clamp((clientX - centerX) / (rect.width * 0.45), -1, 1);
        const deadzone = isMobile ? 0.04 : 0.08;
        const absNorm = Math.abs(normX);
        if (absNorm > deadzone) {
          const rescaled = (absNorm - deadzone) / (1.0 - deadzone);
          const steerVal = isMobile
            ? Math.min(1.0, Math.pow(rescaled, 0.80) * 1.55)
            : Math.abs(normX);
          if (normX < 0) {
            input.left = steerVal;
            input.right = 0;
          } else {
            input.right = steerVal;
            input.left = 0;
          }
        } else {
          input.left = 0;
          input.right = 0;
        }
      };

      wheelEl.addEventListener("touchstart", (ev) => {
        ev.preventDefault();
        if (ev.changedTouches.length > 0) {
          const t = ev.changedTouches[0];
          wheelTouchId = t.identifier;
          updateWheelTouch(t.clientX);
        }
      }, { passive: false });

      wheelEl.addEventListener("touchmove", (ev) => {
        ev.preventDefault();
        for (let i = 0; i < ev.touches.length; i++) {
          if (ev.touches[i].identifier === wheelTouchId) {
            updateWheelTouch(ev.touches[i].clientX);
            break;
          }
        }
      }, { passive: false });

      const endWheelTouch = (ev) => {
        ev.preventDefault();
        wheelTouchId = null;
        input.left = 0;
        input.right = 0;
      };
      wheelEl.addEventListener("touchend", endWheelTouch, { passive: false });
      wheelEl.addEventListener("touchcancel", endWheelTouch, { passive: false });
    }

    const btnStart = document.getElementById("btn-start-race");
    if (btnStart) {
      btnStart.addEventListener("click", () => startStageSession("RECON"));
    }

    const btnNextStage = document.getElementById("btn-next-stage");
    if (btnNextStage) {
      btnNextStage.addEventListener("click", () => {
        const next = getActiveStageConfig().nextStage;
        if (next) {
          startStageSession(next);
        }
      });
    }

    const btnSkipStage = document.getElementById("btn-skip-stage");
    if (btnSkipStage) {
      btnSkipStage.addEventListener("click", () => {
        if (gameState === "RACING" || gameState === "COUNTDOWN") {
          onStageComplete();
        }
      });
    }

    const btnRestart = document.getElementById("btn-restart-race");
    if (btnRestart) {
      btnRestart.addEventListener("click", () => startStageSession(currentStage));
    }

    const btnBackMenu = document.getElementById("btn-back-menu");
    if (btnBackMenu) {
      btnBackMenu.addEventListener("click", exitToMainMenu);
    }

    const accelBadgeEl = document.getElementById("accel-tilt-badge");
    if (accelBadgeEl) {
      accelBadgeEl.addEventListener("click", (e) => {
        e.stopPropagation();
        tiltZeroOffset += rawTiltDeg;
        const textEl = document.getElementById("accel-tilt-text");
        if (textEl) textEl.textContent = "🎯 RE-CALIBRADO";
      });
    }

    const btnPause = document.getElementById("btn-pause-race");
    if (btnPause) {
      btnPause.addEventListener("click", togglePauseRace);
    }

    const btnResume = document.getElementById("btn-resume-race");
    if (btnResume) {
      btnResume.addEventListener("click", togglePauseRace);
    }

    const btnPauseRestart = document.getElementById("btn-pause-restart");
    if (btnPauseRestart) {
      btnPauseRestart.addEventListener("click", () => startStageSession(currentStage));
    }

    const btnPauseMainMenu = document.getElementById("btn-pause-main-menu");
    if (btnPauseMainMenu) {
      btnPauseMainMenu.addEventListener("click", exitToMainMenu);
    }

    const btnCam = document.getElementById("btn-toggle-camera");
    if (btnCam) btnCam.addEventListener("click", toggleCameraMode);

    const btnWeather = document.getElementById("btn-toggle-weather");
    if (btnWeather) btnWeather.addEventListener("click", () => toggleWeatherMode());

    const btnAudio = document.getElementById("btn-toggle-audio");
    if (btnAudio) {
      btnAudio.addEventListener("click", () => {
        if (!audio) return;
        const muted = audio.toggleMute();
        appSettings.audioEnabled = !muted;
        saveSettings();
        btnAudio.textContent = muted ? "🔇" : "🔊";
        const btnAudioOn = document.getElementById("btn-audio-on");
        const btnAudioOff = document.getElementById("btn-audio-off");
        if (btnAudioOn) btnAudioOn.classList.toggle("active", !muted);
        if (btnAudioOff) btnAudioOff.classList.toggle("active", muted);
      });
    }

    document.querySelectorAll(".weather-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const rain = pill.getAttribute("data-rain") === "true";
        appSettings.rainMode = rain;
        saveSettings();
        toggleWeatherMode(rain);
        document.querySelectorAll(".setting-weather-pill").forEach((p) => {
          p.classList.toggle("active", (p.getAttribute("data-rain") === "true") === rain);
        });
        if (net && net.getMode() === "HOST") {
          net.broadcastRosterSync();
        }
      });
    });

    document.querySelectorAll(".diff-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const diffId = pill.getAttribute("data-diff");
        if (DIFFICULTY_CONFIG[diffId]) {
          currentDifficulty = diffId;
          appSettings.difficulty = diffId;
          saveSettings();
          document.querySelectorAll(".diff-pill, .setting-diff-pill").forEach((p) => {
            p.classList.toggle("active", p.getAttribute("data-diff") === currentDifficulty);
          });
          const hudDiffEl = document.getElementById("hud-diff-label");
          if (hudDiffEl) {
            hudDiffEl.textContent = DIFFICULTY_CONFIG[currentDifficulty].label;
          }
          if (net && net.getMode() === "HOST") {
            net.broadcastRosterSync();
          }
        }
      });
    });

    document.querySelectorAll(".cam-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        cameraMode = pill.getAttribute("data-cam");
        document.querySelectorAll(".cam-pill").forEach((p) => {
          p.classList.toggle("active", p.getAttribute("data-cam") === cameraMode);
        });
        const btnCamLabel = document.getElementById("btn-camera-label");
        if (btnCamLabel) {
          btnCamLabel.textContent = cameraMode === "COCKPIT" ? "Cámara: Cockpit (1ªP)" : "Cámara: Exterior (3ªP)";
        }
      });
    });

    // Controles de Sala Multijugador Online (Crear Sala / Unirse con Código / Copiar / Salir)
    const btnCreateRoom = document.getElementById("btn-create-room");
    const btnJoinRoom = document.getElementById("btn-join-room");
    const inputRoomCode = document.getElementById("input-room-code");
    const btnCopyRoom = document.getElementById("btn-copy-room");
    const btnLeaveRoom = document.getElementById("btn-leave-room");

    if (btnCreateRoom) {
      btnCreateRoom.addEventListener("click", () => {
        if (net) net.createRoom(selectedRacerId);
      });
    }

    if (btnJoinRoom && inputRoomCode) {
      btnJoinRoom.addEventListener("click", () => {
        if (net) net.joinRoom(inputRoomCode.value, selectedRacerId);
      });
      inputRoomCode.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter" && net) {
          net.joinRoom(inputRoomCode.value, selectedRacerId);
        }
      });
    }

    if (btnCopyRoom) {
      btnCopyRoom.addEventListener("click", () => {
        if (!net || !net.getRoomCode()) return;
        const codeStr = "KART-" + net.getRoomCode();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(codeStr).catch(() => { });
        }
        btnCopyRoom.textContent = "✅ Copiado";
        setTimeout(() => { btnCopyRoom.textContent = "📋 Copiar"; }, 1600);
      });
    }

    if (btnLeaveRoom) {
      btnLeaveRoom.addEventListener("click", () => {
        if (net) net.leaveRoom();
      });
    }

    // ==================== PANTALLA COMPLETA E INSTALACIÓN PWA EN ANDROID ====================
    function toggleFullscreenMode() {
      const docEl = document.documentElement;
      const isFull = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFull) {
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(docEl))
            .then(() => {
              if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock("landscape").catch(() => { });
              }
            })
            .catch(() => { });
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) {
          Promise.resolve(exit.call(document)).catch(() => { });
        }
      }
    }

    const btnFullMenu = document.getElementById("btn-fullscreen-menu");
    const btnFullHud = document.getElementById("btn-fullscreen-hud");
    if (btnFullMenu) btnFullMenu.addEventListener("click", toggleFullscreenMode);
    if (btnFullHud) btnFullHud.addEventListener("click", toggleFullscreenMode);

    let deferredInstallPrompt = null;
    const btnInstallPwa = document.getElementById("btn-install-pwa");

    window.addEventListener("beforeinstallprompt", (ev) => {
      ev.preventDefault();
      deferredInstallPrompt = ev;
      if (btnInstallPwa) {
        btnInstallPwa.classList.remove("hidden");
      }
    });

    if (btnInstallPwa) {
      btnInstallPwa.addEventListener("click", () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.finally(() => {
            deferredInstallPrompt = null;
            btnInstallPwa.classList.add("hidden");
          });
        } else {
          toggleFullscreenMode();
        }
      });
    }

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      if (btnInstallPwa) btnInstallPwa.classList.add("hidden");
    });

    if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost")) {
      navigator.serviceWorker.register("./sw.js").catch(() => { });
    }
  }

  function setupSettingsModalListeners() {
    const modal = document.getElementById("settings-modal");
    const openBtns = [
      document.getElementById("btn-settings-menu"),
      document.getElementById("btn-settings-hud"),
      document.getElementById("btn-settings-pause")
    ];
    const closeBtn = document.getElementById("btn-close-settings");

    openBtns.forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => {
          applyAllSettings();
          if (modal) modal.classList.remove("hidden");
        });
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        saveSettings();
        if (modal) modal.classList.add("hidden");
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          saveSettings();
          modal.classList.add("hidden");
        }
      });
    }

    // Slider Sensibilidad
    const sensInput = document.getElementById("setting-steer-sens");
    const sensVal = document.getElementById("setting-steer-sens-val");
    if (sensInput) {
      sensInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        if (sensVal) sensVal.textContent = val + "%";
        appSettings.steerSensitivity = val / 100;
        saveSettings();
      });
    }

    // Modo de Control en móvil (Joystick vs Acelerómetro)
    const btnAccel = document.getElementById("btn-control-accel");
    const btnJoy = document.getElementById("btn-control-joystick");
    if (btnJoy) {
      btnJoy.addEventListener("click", () => {
        appSettings.controlMode = "JOYSTICK";
        updateControlModeUI();
        saveSettings();
      });
    }
    if (btnAccel) {
      btnAccel.addEventListener("click", () => {
        appSettings.controlMode = "ACCELEROMETER";
        updateControlModeUI();
        saveSettings();
      });
    }

    // Invertir Acelerómetro
    const btnInvOn = document.getElementById("btn-invert-accel-on");
    const btnInvOff = document.getElementById("btn-invert-accel-off");
    if (btnInvOn) {
      btnInvOn.addEventListener("click", () => {
        appSettings.invertAccelerometer = true;
        btnInvOn.classList.add("active");
        if (btnInvOff) btnInvOff.classList.remove("active");
        saveSettings();
      });
    }
    if (btnInvOff) {
      btnInvOff.addEventListener("click", () => {
        appSettings.invertAccelerometer = false;
        btnInvOff.classList.add("active");
        if (btnInvOn) btnInvOn.classList.remove("active");
        saveSettings();
      });
    }

    // Audio ON / OFF
    const btnAudioOn = document.getElementById("btn-audio-on");
    const btnAudioOff = document.getElementById("btn-audio-off");
    if (btnAudioOn) {
      btnAudioOn.addEventListener("click", () => {
        appSettings.audioEnabled = true;
        btnAudioOn.classList.add("active");
        if (btnAudioOff) btnAudioOff.classList.remove("active");
        if (audio) audio.setMuted(false);
        const hudAudio = document.getElementById("btn-toggle-audio");
        if (hudAudio) hudAudio.textContent = "🔊";
        saveSettings();
      });
    }
    if (btnAudioOff) {
      btnAudioOff.addEventListener("click", () => {
        appSettings.audioEnabled = false;
        btnAudioOff.classList.add("active");
        if (btnAudioOn) btnAudioOn.classList.remove("active");
        if (audio) audio.setMuted(true);
        const hudAudio = document.getElementById("btn-toggle-audio");
        if (hudAudio) hudAudio.textContent = "🔇";
        saveSettings();
      });
    }

    // Dificultad en Settings
    document.querySelectorAll(".setting-diff-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const diff = pill.getAttribute("data-diff");
        if (DIFFICULTY_CONFIG[diff]) {
          appSettings.difficulty = diff;
          currentDifficulty = diff;
          document.querySelectorAll(".diff-pill, .setting-diff-pill").forEach((p) => {
            p.classList.toggle("active", p.getAttribute("data-diff") === diff);
          });
          const hudDiffEl = document.getElementById("hud-diff-label");
          if (hudDiffEl) hudDiffEl.textContent = DIFFICULTY_CONFIG[diff].label;
          if (net && net.getMode() === "HOST") {
            net.broadcastRosterSync();
          }
          saveSettings();
        }
      });
    });

    // Clima en Settings
    document.querySelectorAll(".setting-weather-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const rain = pill.getAttribute("data-rain") === "true";
        appSettings.rainMode = rain;
        toggleWeatherMode(rain);
        document.querySelectorAll(".setting-weather-pill").forEach((p) => {
          p.classList.toggle("active", (p.getAttribute("data-rain") === "true") === rain);
        });
        if (net && net.getMode() === "HOST") {
          net.broadcastRosterSync();
        }
        saveSettings();
      });
    });

    // Vueltas en Settings (Stepper + Presets)
    const btnMinus = document.getElementById("btn-laps-minus");
    const btnPlus = document.getElementById("btn-laps-plus");
    const inputLaps = document.getElementById("setting-race-laps");

    if (btnMinus) {
      btnMinus.addEventListener("click", () => {
        const current = parseInt(inputLaps.value, 10) || 30;
        applyRaceLaps(Math.max(1, current - 1));
        saveSettings();
      });
    }
    if (btnPlus) {
      btnPlus.addEventListener("click", () => {
        const current = parseInt(inputLaps.value, 10) || 30;
        applyRaceLaps(Math.min(100, current + 1));
        saveSettings();
      });
    }
    if (inputLaps) {
      inputLaps.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1 && val <= 100) {
          applyRaceLaps(val);
          saveSettings();
        }
      });
    }
    document.querySelectorAll(".laps-pill").forEach((p) => {
      p.addEventListener("click", () => {
        const laps = parseInt(p.getAttribute("data-laps"), 10);
        applyRaceLaps(laps);
        saveSettings();
      });
    });
  }

  window.initKartRacerGame = function () {
    loadSavedSettings();
    isRainMode = appSettings.rainMode;
    currentDifficulty = appSettings.difficulty;

    const container = document.getElementById("webgl-container");
    const visorCanvas = document.getElementById("visor-rain-canvas");
    minimapCanvas = document.getElementById("minimap-canvas");
    if (minimapCanvas) minimapCtx = minimapCanvas.getContext("2d");

    scene = new THREE.Scene();

    const isMobile = isMobilePlatform();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.25, 750);

    const rendererOpts = {
      antialias: !isMobile,
      powerPreference: "default",
      precision: isMobile ? "mediump" : "highp",
      stencil: false,
      depth: true
    };

    try {
      renderer = new THREE.WebGLRenderer(rendererOpts);
    } catch (e) {
      console.warn("Fallo WebGLRenderer con opciones estándar, reintentando con opciones mínimas:", e);
      renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false });
    }

    const pr = isMobile ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Evitar desbordes de memoria en GPUs móviles (evita crash y pantalla blanca [x_x] en Chrome/Android)
    const canUseShadows = !isMobile || (window.innerWidth >= 600 && (navigator.hardwareConcurrency || 4) >= 4);
    renderer.shadowMap.enabled = canUseShadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // Manejo y recuperación de contexto WebGL para prevenir la pantalla blanca [x_x]
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      console.warn("KartLibre 3D: WebGL context lost. Previniendo pantalla blanca y recuperando contexto...");
      renderer.shadowMap.enabled = false;
      renderer.setPixelRatio(1.0);
    }, false);

    renderer.domElement.addEventListener("webglcontextrestored", () => {
      console.info("KartLibre 3D: WebGL context restored exitosamente.");
      setupSkyAndLights(isRainMode);
      try {
        if (renderer) {
        try {
          renderer.render(scene, camera);
        } catch (e) {
          // Si el contexto se pierde temporalmente, no abortar el bucle animate
        }
      }
      } catch (err) {}
    }, false);

    ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0x8899AA, 0x2A3228, 0.65);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xFFF6E0, 0.9);
    sunLight.position.set(85, 140, 65);
    sunLight.castShadow = canUseShadows;
    const shadowMapSize = isMobile ? 512 : 1024;
    sunLight.shadow.mapSize.width = shadowMapSize;
    sunLight.shadow.mapSize.height = shadowMapSize;
    sunLight.shadow.camera.near = 15;
    sunLight.shadow.camera.far = 380;
    const d = 140;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0006;
    scene.add(sunLight);

    track = window.buildKartodromoTrack(scene, isRainMode);
    weather = window.createWeatherSystem(scene, visorCanvas);
    audio = window.createKartAudio();
    setupSkyAndLights(isRainMode);

    if (typeof window.createNetworkManager === "function") {
      net = window.createNetworkManager({
        getHostLobbySettings: () => ({
          difficulty: currentDifficulty,
          isRainMode,
          gridOrderIds: currentGridOrder.map((r) => r.id)
        }),
        onStatusChange: (mode, roomCode, message, isError) => {
          const pillEl = document.getElementById("online-mode-pill");
          const defaultRow = document.getElementById("online-controls-default");
          const activeRow = document.getElementById("online-controls-active");
          const codeLabel = document.getElementById("online-room-code-label");
          const statusText = document.getElementById("online-status-text");
          const btnStart = document.getElementById("btn-start-race");

          if (pillEl) {
            const isOnline = mode !== "OFFLINE";
            pillEl.classList.toggle("online-active", isOnline);
            pillEl.textContent = isOnline
              ? (mode === "HOST" ? "🟢 Anfitrión Online" : "🟢 Conectado Online")
              : "Offline (1 Jug. + 7 Bots)";
          }
          if (defaultRow && activeRow) {
            defaultRow.classList.toggle("hidden", mode !== "OFFLINE");
            activeRow.classList.toggle("hidden", mode === "OFFLINE");
          }
          if (codeLabel && roomCode) {
            codeLabel.textContent = "KART-" + roomCode;
          }
          if (statusText && message) {
            statusText.textContent = message;
            statusText.style.color = isError ? "#FCA5A5" : "#94A3B8";
          }
          if (btnStart) {
            btnStart.textContent =
              mode === "CLIENT"
                ? "⏳ ESPERANDO AL ANFITRIÓN DE LA SALA..."
                : "🏁 ¡SALIR A PISTA (RECONOCIMIENTO)!";
          }
          buildRacerCardsUI();
        },
        onRosterUpdated: (claimedMap, myPeerId, mode, roomCode, syncData) => {
          const myAssignedRacer = net.getMyRacerId();
          if (myAssignedRacer && myAssignedRacer !== selectedRacerId) {
            selectedRacerId = myAssignedRacer;
          }
          if (mode === "CLIENT" && syncData) {
            if (syncData.difficulty && DIFFICULTY_CONFIG[syncData.difficulty]) {
              currentDifficulty = syncData.difficulty;
            }
            if (typeof syncData.isRainMode === "boolean" && syncData.isRainMode !== isRainMode) {
              toggleWeatherMode(syncData.isRainMode);
            }
          }
          const humanCount = Object.keys(claimedMap || {}).length;
          const freeCount = 8 - humanCount;
          const statusText = document.getElementById("online-status-text");
          if (statusText && mode !== "OFFLINE") {
            const myRacerObj = window.RACERS_LIST.find((r) => r.id === selectedRacerId);
            statusText.style.color = "#86EFAC";
            statusText.textContent =
              `Sala KART-${roomCode} • ${humanCount}/8 humanos (${freeCount} libres) • Tu piloto exclusivo: #${selectedRacerId} ${myRacerObj ? myRacerObj.name : ""}`;
          }
          buildRacerCardsUI();
          if (gameState === "MENU") {
            spawnGrid(currentGridOrder);
          }
        },
        onRemoteStartStage: (cfg) => {
          if (cfg.difficulty && DIFFICULTY_CONFIG[cfg.difficulty]) {
            currentDifficulty = cfg.difficulty;
          }
          if (typeof cfg.isRainMode === "boolean" && cfg.isRainMode !== isRainMode) {
            toggleWeatherMode(cfg.isRainMode);
          }
          if (Array.isArray(cfg.gridOrderIds) && cfg.gridOrderIds.length === 8) {
            const mapped = cfg.gridOrderIds
              .map((id) => window.RACERS_LIST.find((r) => r.id === id))
              .filter(Boolean);
            if (mapped.length === 8) {
              currentGridOrder = mapped;
            }
          }
          startStageSession(cfg.stage || "RECON", true);
        },
        onClientKartState: (pkt) => {
          const targetKart = karts.find((k) => k.racer.id === pkt.racerId);
          if (targetKart && !targetKart.isPlayer) {
            applyPacketToKartTarget(targetKart, pkt);
          }
        },
        onWorldSnapshot: (kartPackets, hostRaceTime) => {
          if (Math.abs(hostRaceTime - raceTime) > 0.35 && gameState === "RACING") {
            raceTime = hostRaceTime;
          }
          kartPackets.forEach((pkt) => {
            const targetKart = karts.find((k) => k.racer.id === pkt.racerId);
            if (targetKart && !targetKart.isPlayer) {
              applyPacketToKartTarget(targetKart, pkt);
            }
          });
        },
        onRemoteStageComplete: (data) => {
          if (data && Array.isArray(data.gridOrderIds) && data.gridOrderIds.length === 8) {
            const mapped = data.gridOrderIds
              .map((id) => window.RACERS_LIST.find((r) => r.id === id))
              .filter(Boolean);
            if (mapped.length === 8) {
              currentGridOrder = mapped;
            }
          }
          if (gameState === "RACING") {
            onStageComplete();
          }
        }
      });
    }

    buildRacerCardsUI();
    spawnGrid(currentGridOrder);
    bindControls();
    setupSettingsModalListeners();
    applyAllSettings();

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("racer")) {
        const parsedRacer = parseInt(params.get("racer"), 10);
        if (Number.isInteger(parsedRacer) && window.RACERS_LIST.some((r) => r.id === parsedRacer)) {
          selectedRacerId = parsedRacer;
          buildRacerCardsUI();
          spawnGrid(currentGridOrder);
        }
      }
      if (params.has("rain")) {
        toggleWeatherMode(params.get("rain") !== "0" && params.get("rain") !== "false");
      }
      if (params.has("cam")) {
        const rawCam = String(params.get("cam") || "").toUpperCase();
        cameraMode = rawCam === "COCKPIT" ? "COCKPIT" : "CHASE";
      }
      if (params.get("autostart") === "1") {
        const rawStage = String(params.get("stage") || "").toUpperCase();
        const safeStage = Object.prototype.hasOwnProperty.call(STAGE_CONFIG, rawStage) ? rawStage : "RECON";
        startStageSession(safeStage);
        countdownTimer = 0.05;
      }
    } catch (e) { }

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const currentPr = isMobilePlatform() ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(currentPr);
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let lastTime = performance.now();
    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (track && track.blimpGroup) {
        const bAngle = now * 0.00008;
        track.blimpGroup.position.x = Math.cos(bAngle) * 95;
        track.blimpGroup.position.z = Math.sin(bAngle) * 75 - 20;
        track.blimpGroup.rotation.y = -bAngle;
      }

      // Sincronización del acelerómetro en dispositivos móviles (inclinar el celular para doblar)
      const hasKeyboardSteer = keys["KeyA"] || keys["KeyD"] || keys["ArrowLeft"] || keys["ArrowRight"];
      if ((isMobilePlatform() || accelActive) && appSettings.controlMode === "ACCELEROMETER" && !hasKeyboardSteer) {
        smoothTiltSteer = THREE.MathUtils.lerp(smoothTiltSteer, targetTiltSteer, Math.min(1, dt * 18.0));
        if (smoothTiltSteer < -0.01) {
          input.left = Math.abs(smoothTiltSteer);
          input.right = 0;
        } else if (smoothTiltSteer > 0.01) {
          input.right = smoothTiltSteer;
          input.left = 0;
        } else {
          input.left = 0;
          input.right = 0;
        }
      }

      if (gameState === "COUNTDOWN") {
        countdownTimer -= dt;
        const secLeft = Math.ceil(countdownTimer);
        if (secLeft !== lastBeepSec && secLeft >= 1 && secLeft <= 3) {
          lastBeepSec = secLeft;
          if (audio) audio.playBeep(440, 0.14);
        }

        for (let l = 1; l <= 3; l++) {
          const bulb = document.getElementById("light-" + l);
          if (bulb) {
            bulb.className = "start-bulb " + (secLeft <= 3 && (4 - secLeft) >= l ? "red-on" : "");
          }
        }

        karts.forEach((k) => updateKartPhysics(k, dt, false));

        if (countdownTimer <= 0) {
          gameState = "RACING";
          karts.forEach((k) => { k.lapStartTime = raceTime; });
          if (audio) audio.playBeep(880, 0.32);
          for (let l = 1; l <= 3; l++) {
            const bulb = document.getElementById("light-" + l);
            if (bulb) bulb.className = "start-bulb green-on";
          }
          setTimeout(() => {
            const lightsEl = document.getElementById("start-lights");
            if (lightsEl) lightsEl.classList.add("hidden");
          }, 900);
        }
      } else if (gameState === "PAUSED") {
        // En pausa se mantiene congelada la física y el cronómetro
      } else if (gameState === "RACING" || gameState === "STAGE_COMPLETE" || gameState === "FINISHED") {
        if (gameState === "RACING") {
          raceTime += dt;
        }
        karts.forEach((k) => updateKartPhysics(k, dt, gameState === "RACING"));
        if (gameState === "RACING") {
          resolveKartCollisions();
          if (net) {
            net.syncRaceTick(now, karts, playerKart, raceTime);
          }
        }
      } else {
        if (playerKart) {
          playerKart.visual.updateVisuals(dt, {
            speed: 4,
            steerAngle: Math.sin(now * 0.0018) * 0.24,
            accelG: 0,
            rpmNorm: 0.35,
            gear: 1,
            lapTimeSec: 0,
            isFirstPerson: false
          });
        }
      }

      updateCamera(dt);

      const playerSpeedKmh = playerKart ? Math.abs(playerKart.speed) * 3.6 : 0;
      const { rpmNorm } = playerKart ? computeGearAndRpm(playerKart.speed) : { rpmNorm: 0.2 };

      if (weather) {
        weather.update(dt, camera.position, playerSpeedKmh);
      }
      if (audio) {
        audio.updateEngine(
          rpmNorm,
          playerSpeedKmh,
          gameState === "RACING",
          playerKart ? playerKart.slideRatio || 0 : 0
        );
      }
      if (gameState !== "MENU") {
        updateHUD();
      }

      if (renderer) {
        try {
          renderer.render(scene, camera);
        } catch (e) {
          // Si el contexto se pierde temporalmente, no abortar el bucle animate
        }
      }
    }

    requestAnimationFrame(animate);
  };

  window.addEventListener("DOMContentLoaded", function () {
    window.initKartRacerGame();
  });
})();
