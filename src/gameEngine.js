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
      title: "ETAPA 3/3 • CARRERA FINAL (30 VUELTAS)",
      shortTitle: "Carrera Final (30 Vueltas)",
      laps: 30,
      nextStage: null
    }
  };

  // Configuración de los 3 Niveles de Dificultad de la IA (Fácil, Medio, Difícil)
  const DIFFICULTY_CONFIG = {
    EASY: {
      id: "EASY",
      label: "🟢 Fácil",
      paceMult: 0.83,
      cornerSpeedMult: 0.82,
      accelMult: 0.80,
      linePrecision: 0.45,
      overtakeRate: 1.5,
      qualyBaseSec: 41.5
    },
    MEDIUM: {
      id: "MEDIUM",
      label: "🟡 Medio",
      paceMult: 0.94,
      cornerSpeedMult: 0.94,
      accelMult: 0.96,
      linePrecision: 0.82,
      overtakeRate: 2.2,
      qualyBaseSec: 36.5
    },
    HARD: {
      id: "HARD",
      label: "🔴 Difícil",
      paceMult: 1.03,
      cornerSpeedMult: 1.02,
      accelMult: 1.14,
      linePrecision: 1.00,
      overtakeRate: 3.0,
      qualyBaseSec: 33.2
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

  // Actualización física del jugador e IA competitiva para los otros 7 corredores
  function updateKartPhysics(k, dt, canMove) {
    const stageCfg = getActiveStageConfig();
    const totalStageLaps = stageCfg.laps;
    const prevSpeed = k.speed;

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

      // 1. Reacción al girar más lenta, progresiva y realista (sensible a la velocidad)
      const maxSteerLock = 0.40 * (1.0 - speedRatio * 0.22);
      const targetSteer = rawSteerInput * maxSteerLock;
      const isCentering = Math.abs(targetSteer) < Math.abs(k.steerAngle) && Math.sign(targetSteer || k.steerAngle) === Math.sign(k.steerAngle);
      const steerResponseRate = isCentering ? 3.6 : (2.35 * (1.0 - speedRatio * 0.28));
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
      const speedFactor = THREE.MathUtils.clamp(absSpd / 3.5, 0, 1);
      const turnDir = k.speed >= -0.1 ? 1 : -1;
      const baseTurnRate = 2.45 * (1.0 - speedRatio * 0.34);
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
          "Los 8 corredores han sido ordenados por su mejor tiempo de clasificación para largar la Carrera Final de 30 Vueltas:";
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
        btnNextStage.textContent = "🏁 LARGAR CARRERA FINAL (30 VUELTAS) ▶";
      }
      if (modal) modal.classList.remove("hidden");
    } else {
      // Final de la Carrera de 30 Vueltas
      gameState = "FINISHED";
      const sorted = getSortedStandings();
      const playerRank = sorted.indexOf(playerKart) + 1;

      if (badgeEl) badgeEl.textContent = "Etapa 3/3 Completada • Carrera Final (30 Vueltas)";
      if (title) {
        title.textContent =
          playerRank === 1
            ? `🏆 ¡VICTORIA DE ${playerKart.racer.name.toUpperCase()} EN BUENOS AIRES!`
            : `🏁 ¡CARRERA FINALIZADA! PUESTO ${playerRank}°`;
      }
      if (subtitle) {
        subtitle.textContent = "Resultado oficial tras las 30 vueltas al Kartódromo Ciudad de Buenos Aires:";
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

    gridEl.textContent = "";
    window.RACERS_LIST.forEach((r) => {
      const btn = document.createElement("button");
      btn.className = "racer-card" + (r.id === selectedRacerId ? " active" : "");
      btn.setAttribute("data-racer-id", String(r.id));

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
      titleDiv.textContent = String(r.rawName);

      const subDiv = document.createElement("div");
      subDiv.className = "racer-sub";
      subDiv.textContent = "Kart #" + Number(r.number) + " • " + String(r.name);

      info.appendChild(titleDiv);
      info.appendChild(subDiv);

      btn.appendChild(swatch);
      btn.appendChild(info);

      btn.addEventListener("click", () => {
        selectedRacerId = r.id;
        buildRacerCardsUI();
        currentGridOrder = window.RACERS_LIST.slice();
        spawnGrid(currentGridOrder);
      });

      gridEl.appendChild(btn);
    });
  }

  function startStageSession(stageId) {
    if (audio) audio.init();
    currentStage = stageId || "RECON";

    // Si comenzamos Reconocimiento desde el menú, orden inicial 1 al 8 (con el jugador en su puesto original)
    if (currentStage === "RECON") {
      currentGridOrder = window.RACERS_LIST.slice();
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
    setupSkyAndLights(isRainMode);
    if (track) track.setWeatherMode(isRainMode);
    if (weather) weather.setRainMode(isRainMode);

    const btnWeather = document.getElementById("btn-weather-label");
    if (btnWeather) {
      btnWeather.textContent = isRainMode ? "Clima: Lluvia (Mojado)" : "Clima: Soleado (Seco)";
    }
    document.querySelectorAll(".weather-pill").forEach((el) => {
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
    bindHoldButton("steer-left-btn", () => { input.left = 1; }, () => { input.left = 0; });
    bindHoldButton("steer-right-btn", () => { input.right = 1; }, () => { input.right = 0; });

    // Soporte táctil analógico sobre el volante virtual en dispositivos móviles
    const wheelEl = document.getElementById("ui-steering-wheel");
    if (wheelEl) {
      let wheelTouchId = null;
      const updateWheelTouch = (clientX) => {
        const rect = wheelEl.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const normX = THREE.MathUtils.clamp((clientX - centerX) / (rect.width * 0.45), -1, 1);
        if (normX < -0.08) {
          input.left = Math.abs(normX);
          input.right = 0;
        } else if (normX > 0.08) {
          input.right = Math.abs(normX);
          input.left = 0;
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
        btnAudio.textContent = muted ? "🔇" : "🔊";
      });
    }

    document.querySelectorAll(".weather-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        toggleWeatherMode(pill.getAttribute("data-rain") === "true");
      });
    });

    document.querySelectorAll(".diff-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const diffId = pill.getAttribute("data-diff");
        if (DIFFICULTY_CONFIG[diffId]) {
          currentDifficulty = diffId;
          document.querySelectorAll(".diff-pill").forEach((p) => {
            p.classList.toggle("active", p.getAttribute("data-diff") === currentDifficulty);
          });
          const hudDiffEl = document.getElementById("hud-diff-label");
          if (hudDiffEl) {
            hudDiffEl.textContent = DIFFICULTY_CONFIG[currentDifficulty].label;
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
  }

  window.initKartRacerGame = function () {
    const container = document.getElementById("webgl-container");
    const visorCanvas = document.getElementById("visor-rain-canvas");
    minimapCanvas = document.getElementById("minimap-canvas");
    if (minimapCanvas) minimapCtx = minimapCanvas.getContext("2d");

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 900);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0x8899AA, 0x2A3228, 0.65);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xFFF6E0, 0.9);
    sunLight.position.set(85, 140, 65);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 420;
    const d = 160;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    track = window.buildKartodromoTrack(scene, isRainMode);
    weather = window.createWeatherSystem(scene, visorCanvas);
    audio = window.createKartAudio();
    setupSkyAndLights(isRainMode);

    buildRacerCardsUI();
    spawnGrid(currentGridOrder);
    bindControls();

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
    } catch (e) {}

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
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

      renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);
  };

  window.addEventListener("DOMContentLoaded", function () {
    window.initKartRacerGame();
  });
})();
