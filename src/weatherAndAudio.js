// Sistema de Clima (Lluvia 3D, Gotas refractivas en el Visor como en la Imagen 1)
// y Motor de Audio Sintetizado (Motor de Karting 2 Tiempos + Lluvia + Derrape)

(function () {
  window.createWeatherSystem = function (scene, visorCanvas) {
    let isRain = true;

    // 1. Partículas 3D de lluvia alrededor de la cámara
    const RAIN_COUNT = 1400;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 3 + 0] = (Math.random() - 0.5) * 70;
      rainPos[i * 3 + 1] = Math.random() * 26;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xC8D8E8,
      size: 0.22,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    scene.add(rainPoints);

    // 2. Gotas de agua realistas sobre el visor/lente (Idéntico a la Imagen 1 de referencia)
    const vctx = visorCanvas.getContext("2d");
    const droplets = [];
    const DROPLET_COUNT = 52;

    for (let i = 0; i < DROPLET_COUNT; i++) {
      droplets.push({
        x: Math.random(),
        y: Math.random(),
        r: 6 + Math.random() * 15,
        vx: (Math.random() - 0.5) * 0.008,
        vy: 0.01 + Math.random() * 0.03,
        alpha: 0.45 + Math.random() * 0.4,
        wobble: Math.random() * Math.PI * 2
      });
    }

    function updateVisorDroplets(dt, speedKmh) {
      if (visorCanvas.width !== window.innerWidth || visorCanvas.height !== window.innerHeight) {
        visorCanvas.width = window.innerWidth;
        visorCanvas.height = window.innerHeight;
      }
      vctx.clearRect(0, 0, visorCanvas.width, visorCanvas.height);
      if (!isRain) return;

      const W = visorCanvas.width;
      const H = visorCanvas.height;
      const windFactor = Math.min(1.8, speedKmh / 75);

      for (let i = 0; i < droplets.length; i++) {
        const d = droplets[i];
        d.wobble += dt * 3.5;

        // El viento a alta velocidad empuja las gotas hacia los bordes exteriores del visor
        const dirX = d.x - 0.5;
        d.x += (dirX * windFactor * 0.14 + Math.sin(d.wobble) * 0.004) * dt;
        d.y += (d.vy * (1 - windFactor * 0.35)) * dt;

        if (d.y > 1.06 || d.x < -0.06 || d.x > 1.06) {
          d.x = 0.08 + Math.random() * 0.84;
          d.y = -0.04 - Math.random() * 0.25;
          d.r = 6 + Math.random() * 15;
        }

        const cx = d.x * W;
        const cy = d.y * H;
        const rx = d.r;
        const ry = d.r * 1.18;

        vctx.save();
        vctx.translate(cx, cy);

        // Sombra oscura del borde superior/inferior de refracción (exacto al look de la Imagen 1)
        const grad = vctx.createRadialGradient(-rx * 0.2, -ry * 0.25, rx * 0.1, 0, 0, ry);
        grad.addColorStop(0.0, `rgba(235, 245, 255, ${d.alpha * 0.72})`);
        grad.addColorStop(0.55, `rgba(130, 150, 165, ${d.alpha * 0.28})`);
        grad.addColorStop(0.85, `rgba(25, 35, 42, ${d.alpha * 0.62})`);
        grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

        vctx.fillStyle = grad;
        vctx.beginPath();
        vctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        vctx.fill();

        // Brillo especular inferior de la gota
        vctx.fillStyle = `rgba(255, 255, 255, ${d.alpha * 0.65})`;
        vctx.beginPath();
        vctx.ellipse(rx * 0.22, ry * 0.32, rx * 0.28, ry * 0.18, -0.3, 0, Math.PI * 2);
        vctx.fill();

        vctx.restore();
      }
    }

    function update(dt, cameraPos, speedKmh) {
      rainPoints.visible = isRain;
      if (isRain) {
        const arr = rainGeo.attributes.position.array;
        for (let i = 0; i < RAIN_COUNT; i++) {
          arr[i * 3 + 1] -= 26 * dt;
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3 + 0] = cameraPos.x + (Math.random() - 0.5) * 70;
            arr[i * 3 + 1] = 22 + Math.random() * 6;
            arr[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * 70;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      updateVisorDroplets(dt, speedKmh);
    }

    function setRainMode(enabled) {
      isRain = Boolean(enabled);
      rainPoints.visible = isRain;
      if (!isRain) {
        vctx.clearRect(0, 0, visorCanvas.width, visorCanvas.height);
      }
    }

    return {
      update,
      setRainMode,
      isRain: () => isRain
    };
  };

  // Sintetizador Web Audio para el motor de Karting 2 Tiempos y efectos
  window.createKartAudio = function () {
    let ctx = null;
    let osc1 = null;
    let osc2 = null;
    let engineGain = null;
    let skidOsc = null;
    let skidGain = null;
    let muted = false;
    let started = false;

    function init() {
      if (started) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        ctx = new AudioCtx();

        osc1 = ctx.createOscillator();
        osc2 = ctx.createOscillator();
        osc1.type = "sawtooth";
        osc2.type = "triangle";

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 820;

        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(ctx.destination);

        // Generador de chirrido de neumáticos al resbalar por exceso de velocidad en curva
        skidOsc = ctx.createOscillator();
        skidOsc.type = "triangle";
        skidOsc.frequency.value = 680;
        const skidFilter = ctx.createBiquadFilter();
        skidFilter.type = "bandpass";
        skidFilter.frequency.value = 740;
        skidFilter.Q.value = 3.5;
        skidGain = ctx.createGain();
        skidGain.gain.value = 0.0;
        skidOsc.connect(skidFilter);
        skidFilter.connect(skidGain);
        skidGain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        skidOsc.start();
        started = true;
      } catch (e) {
        // Silencioso si el navegador bloquea audio antes de interacción
      }
    }

    function updateEngine(rpmNorm, speedKmh, isRacing, slideRatio) {
      if (!started || !ctx || muted) {
        if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        if (skidGain && ctx) skidGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        return;
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const baseFreq = 68 + rpmNorm * 195 + (speedKmh * 0.45);
      osc1.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.04);
      osc2.frequency.setTargetAtTime(baseFreq * 1.5, ctx.currentTime, 0.04);
      const targetVol = isRacing ? (0.045 + rpmNorm * 0.055) : 0.0;
      engineGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.06);

      if (skidGain && skidOsc) {
        const sRatio = isRacing ? Math.min(1, slideRatio || 0) : 0;
        skidOsc.frequency.setTargetAtTime(620 + sRatio * 240, ctx.currentTime, 0.04);
        skidGain.gain.setTargetAtTime(sRatio * 0.055, ctx.currentTime, 0.05);
      }
    }

    function playBeep(freq, duration) {
      if (!started) init();
      if (!ctx || muted) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.value = 0.10;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        o.stop(ctx.currentTime + duration);
      } catch (e) {}
    }

    function toggleMute() {
      muted = !muted;
      return muted;
    }

    return {
      init,
      updateEngine,
      playBeep,
      toggleMute,
      isMuted: () => muted
    };
  };
})();

