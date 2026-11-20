// Generador 3D de Circuitos (Kartódromo V1 y Kartódromo V2 con llantas blancas)
// Soporta V1 (Buenos Aires con Boxes y Torre) y V2 (Internacional rodeado de llantas blancas de 3 de alto)

(function () {
  const DEFAULT_PIXEL_SCALE = 0.34;
  const TRACK_HALF_WIDTH = 6.8; // 13.6m de ancho total para permitir sobrepasos entre los 8 karts

  // Textura de asfalto con líneas blancas laterales, huella húmeda y reflejo especular
  function createAsphaltTexture(isRain) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = isRain ? "#2A2F37" : "#3A3F47";
    ctx.fillRect(0, 0, 512, 512);

    // Granulado del asfalto
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const v = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${v},${v},${v},${isRain ? 0.055 : 0.045})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Huella de caucho más oscura y brillante en el centro
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, "rgba(0,0,0,0.18)");
    grad.addColorStop(0.2, "rgba(255,255,255,0.03)");
    grad.addColorStop(0.5, "rgba(10,14,20,0.22)");
    grad.addColorStop(0.8, "rgba(255,255,255,0.03)");
    grad.addColorStop(1.0, "rgba(0,0,0,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Líneas blancas continuas de borde de pista (como en la Imagen 1)
    ctx.fillStyle = "#E6ECF2";
    ctx.fillRect(18, 0, 12, 512);
    ctx.fillRect(512 - 30, 0, 12, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 95);
    tex.anisotropy = 8;
    return tex;
  }

  // Textura de pasto / césped húmedo (para Kartódromo V1)
  function createGrassTexture(isRain) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = isRain ? "#324424" : "#44622B";
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(85,115,45,0.28)" : "rgba(25,38,15,0.28)";
      ctx.fillRect(x, y, 2, 3);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(90, 90);
    return tex;
  }

  // Textura realista de tierra removida / arada (exclusiva para Kartódromo V2)
  function createDirtTexture(isRain) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Color base terroso: marrón arcilla cálido en seco / chocolate oscuro húmedo en lluvia
    const baseColor = isRain ? "#3E2616" : "#6E4527";
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // 1. Manchas orgánicas de humedad y gradiente de suelo desparejo
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const rad = 45 + Math.random() * 100;
      const grad = ctx.createRadialGradient(rx, ry, 5, rx, ry, rad);
      if (isRain) {
        grad.addColorStop(0, Math.random() > 0.5 ? "rgba(25, 14, 8, 0.55)" : "rgba(75, 46, 27, 0.4)");
      } else {
        grad.addColorStop(0, Math.random() > 0.5 ? "rgba(70, 40, 20, 0.52)" : "rgba(135, 88, 52, 0.45)");
      }
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Surcos ondulados de tierra arada / removida (rastras y huellas de máquina o arado)
    const furrowCount = 52;
    for (let f = 0; f < furrowCount; f++) {
      const yBase = (f / furrowCount) * 512;
      ctx.beginPath();
      let x = 0;
      let y = yBase + (Math.random() - 0.5) * 8;
      ctx.moveTo(x, y);
      while (x < 512) {
        x += 20 + Math.random() * 25;
        y = yBase + Math.sin(x * 0.035 + f * 0.4) * 5 + (Math.random() - 0.5) * 4;
        ctx.lineTo(x, y);
      }
      // Sombra del surco (hendidura en la tierra)
      ctx.lineWidth = 4 + Math.random() * 5;
      ctx.strokeStyle = isRain ? "rgba(15, 8, 4, 0.5)" : "rgba(38, 20, 9, 0.46)";
      ctx.stroke();

      // Cresta iluminada del surco (tierra volcada hacia arriba)
      ctx.beginPath();
      x = 0;
      ctx.moveTo(x, yBase - 2.5);
      while (x < 512) {
        x += 20 + Math.random() * 25;
        y = yBase - 2.5 + Math.sin(x * 0.035 + f * 0.4) * 5 + (Math.random() - 0.5) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.5 + Math.random() * 3;
      ctx.strokeStyle = isRain ? "rgba(95, 58, 34, 0.35)" : "rgba(165, 112, 70, 0.42)";
      ctx.stroke();
    }

    // 3. Terrones y grumos de tierra suelta levantada
    const clodCount = 750;
    for (let c = 0; c < clodCount; c++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const rw = 2.5 + Math.random() * 6;
      const rh = 2 + Math.random() * 4.5;

      // Sombra del terrón
      ctx.fillStyle = isRain ? "rgba(10, 5, 2, 0.6)" : "rgba(25, 12, 5, 0.55)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1.4, rw, rh * 0.9, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();

      // Cuerpo del terrón
      ctx.fillStyle = isRain
        ? (Math.random() > 0.5 ? "#26150B" : "#422816")
        : (Math.random() > 0.5 ? "#56341B" : "#8A5832");
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw * 0.9, rh * 0.8, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();

      // Brillo tenue en el borde superior del terrón
      if (Math.random() > 0.35) {
        ctx.fillStyle = isRain ? "rgba(105, 68, 40, 0.45)" : "rgba(182, 128, 82, 0.45)";
        ctx.beginPath();
        ctx.ellipse(cx - 0.5, cy - 0.8, rw * 0.55, rh * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Granulado fino, arenilla y micropartículas de tierra suelta
    const particleCount = 15000;
    for (let p = 0; p < particleCount; p++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      const rand = Math.random();
      if (rand < 0.35) {
        ctx.fillStyle = isRain ? "rgba(12, 6, 2, 0.55)" : "rgba(30, 16, 7, 0.5)";
      } else if (rand < 0.7) {
        ctx.fillStyle = isRain ? "rgba(80, 48, 28, 0.42)" : "rgba(128, 86, 52, 0.42)";
      } else {
        ctx.fillStyle = isRain ? "rgba(110, 72, 44, 0.35)" : "rgba(188, 138, 92, 0.45)";
      }
      ctx.fillRect(px, py, Math.random() > 0.7 ? 2 : 1, Math.random() > 0.7 ? 2 : 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(75, 75);
    tex.anisotropy = 8;
    return tex;
  }

  // Cartel numerado de curva (1 al 10 como en Kartódromo-V1.jpeg)
  function createCornerSign(num) {
    const group = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: "#CFD8DC", roughness: 0.4, metalness: 0.6 })
    );
    post.position.y = 1.3;
    group.add(post);

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#16191F";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 118, 118);
    ctx.fillStyle = "#16191F";
    ctx.font = "900 72px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 64, 66);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1.7, 0.12),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
    );
    board.position.y = 2.8;
    group.add(board);
    return group;
  }

  // Geometría 3D de una pila de 3 llantas de contención blancas
  function createTripleTireStackGeometry() {
    const pts = [];
    const innerR = 0.20;
    const tireR = 0.44;
    const grooveR = 0.38;
    const tireH = 0.25;

    // Base inferior
    pts.push(new THREE.Vector2(innerR, 0.01));
    pts.push(new THREE.Vector2(tireR * 0.90, 0.02));

    for (let t = 0; t < 3; t++) {
      const baseY = t * tireH + 0.02;
      pts.push(new THREE.Vector2(tireR * 0.98, baseY + tireH * 0.20));
      pts.push(new THREE.Vector2(tireR * 1.04, baseY + tireH * 0.50)); // perfil redondeado de la llanta
      pts.push(new THREE.Vector2(tireR * 0.98, baseY + tireH * 0.80));
      if (t < 2) {
        pts.push(new THREE.Vector2(grooveR, baseY + tireH)); // separación visible entre llantas
      }
    }
    // Tapa y hueco central
    pts.push(new THREE.Vector2(tireR * 0.90, 3 * tireH + 0.02));
    pts.push(new THREE.Vector2(innerR, 3 * tireH + 0.02));
    pts.push(new THREE.Vector2(innerR, 0.01));

    const geo = new THREE.LatheGeometry(pts, 12);
    geo.computeVertexNormals();
    return geo;
  }

  window.buildKartodromoTrack = function (scene, isRain, trackId) {
    trackId = (trackId === "V2") ? "V2" : "V1";
    const trackDef = (window.TRACKS_CATALOG && window.TRACKS_CATALOG[trackId]) || (window.TRACKS_CATALOG && window.TRACKS_CATALOG.V1) || {
      id: "V1",
      scale: 0.34,
      centerX: 800,
      centerY: 520,
      pixelPoints: window.TRACK_PIXEL_POINTS,
      cornerLabels: window.TRACK_CORNER_LABELS,
      hasWhiteTireWalls: false,
      startSampleIndex: 16
    };

    const PIXEL_SCALE = trackDef.scale || DEFAULT_PIXEL_SCALE;
    const CENTER_PX = trackDef.centerX || 800;
    const CENTER_PY = trackDef.centerY || (trackId === "V2" ? 450 : 520);
    const pixelPoints = trackDef.pixelPoints || window.TRACK_PIXEL_POINTS;
    const isV2 = (trackId === "V2");

    function pixelToWorld(px, py) {
      return new THREE.Vector3(
        (px - CENTER_PX) * PIXEL_SCALE,
        0,
        (py - CENTER_PY) * PIXEL_SCALE
      );
    }

    function worldToPixel(x, z) {
      return {
        px: x / PIXEL_SCALE + CENTER_PX,
        py: z / PIXEL_SCALE + CENTER_PY
      };
    }

    const trackGroup = new THREE.Group();
    scene.add(trackGroup);

    // 1. Construir curva cerrada CatmullRomCurve3 a partir de los puntos del trazado seleccionado
    const rawPts = pixelPoints.map((p) => pixelToWorld(p.px, p.py));
    const spline = new THREE.CatmullRomCurve3(rawPts, true, "centripetal", 0.5);

    const SEGMENTS = 720;
    const samples = [];
    let totalLength = 0;

    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const pt = spline.getPointAt(t);
      const tan = spline.getTangentAt(t).normalize();
      // Normal hacia la derecha en el plano XZ
      const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

      // Interpolación de speedHint desde los puntos originales del circuito activo
      const rawIdx = Math.floor(t * pixelPoints.length) % pixelPoints.length;
      const nextRawIdx = (rawIdx + 1) % pixelPoints.length;
      const localFrac = (t * pixelPoints.length) - Math.floor(t * pixelPoints.length);
      const sh = THREE.MathUtils.lerp(
        pixelPoints[rawIdx].speedHint || 1.0,
        pixelPoints[nextRawIdx].speedHint || 1.0,
        localFrac
      );

      if (i > 0) {
        totalLength += pt.distanceTo(samples[i - 1].pt);
      }
      samples.push({
        t,
        pt,
        tan,
        right,
        dist: totalLength,
        speedHint: sh,
        optimalOffset: 0,
        curvature: 0
      });
    }
    totalLength += samples[0].pt.distanceTo(samples[SEGMENTS - 1].pt);

    // Precalcular la Trazada Ideal (Optimal Racing Line: Exterior -> Ápice -> Exterior)
    // manteniéndose siempre dentro del asfalto (máximo ±3.8m respecto al centro de 6.8m de semiancho)
    const rawApex = new Float32Array(SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      const sPrev = samples[(i - 6 + SEGMENTS) % SEGMENTS];
      const sNext = samples[(i + 6) % SEGMENTS];
      const turnDir = sNext.tan.dot(samples[i].right) - sPrev.tan.dot(samples[i].right);
      samples[i].curvature = Math.abs(turnDir);
      // Hacia el ápice interno de la curva
      rawApex[i] = THREE.MathUtils.clamp(turnDir * 14.5, -3.8, 3.8);
    }

    const lineBufA = new Float32Array(SEGMENTS);
    const lineBufB = new Float32Array(SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      const aheadApex = rawApex[(i + 16) % SEGMENTS];
      const curApex = rawApex[i];
      const behindApex = rawApex[(i - 14 + SEGMENTS) % SEGMENTS];
      // Abrirse ligeramente antes de la curva (-0.30), tocar el ápice (+1.05) y abrirse a la salida (-0.20)
      lineBufA[i] = THREE.MathUtils.clamp(curApex * 1.05 - aheadApex * 0.30 - behindApex * 0.20, -3.8, 3.8);
    }

    // Suavizado Gaussiano circular para que la trazada sea una curva continua y fluida
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < SEGMENTS; i++) {
        let sum = 0;
        let wSum = 0;
        for (let k = -6; k <= 6; k++) {
          const w = 7 - Math.abs(k);
          sum += lineBufA[(i + k + SEGMENTS) % SEGMENTS] * w;
          wSum += w;
        }
        lineBufB[i] = sum / wSum;
      }
      lineBufA.set(lineBufB);
    }

    for (let i = 0; i < SEGMENTS; i++) {
      samples[i].optimalOffset = THREE.MathUtils.clamp(lineBufA[i], -3.8, 3.8);
      // Ajustar speedHint según la curvatura geométrica real para que los bots frenen antes de curvas cerradas
      const aheadCurv = Math.max(
        samples[i].curvature,
        samples[(i + 10) % SEGMENTS].curvature,
        samples[(i + 20) % SEGMENTS].curvature
      );
      const geomHint = THREE.MathUtils.clamp(1.0 - aheadCurv * 1.65, 0.44, 1.0);
      samples[i].speedHint = Math.min(samples[i].speedHint, geomHint);
    }

    // 2. Terreno exterior e interior: Tierra removida en Pista V2 / Césped en Pista V1
    const groundTex = isV2 ? createDirtTexture(isRain) : createGrassTexture(isRain);
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400, 16, 16),
      new THREE.MeshStandardMaterial({
        map: groundTex,
        roughness: isRain ? (isV2 ? 0.72 : 0.65) : (isV2 ? 0.94 : 0.88),
        metalness: isV2 ? 0.02 : 0.04,
        polygonOffset: true,
        polygonOffsetFactor: 4.0,
        polygonOffsetUnits: 4.0
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.15;
    groundMesh.receiveShadow = true;
    groundMesh.renderOrder = 0;
    trackGroup.add(groundMesh);

    // 3. Malla continua de Asfalto + Pianitos (Kerbs) Rojos y Blancos
    const roadPositions = [];
    const roadNormals = [];
    const roadUvs = [];
    const roadIndices = [];

    const kerbPositions = [];
    const kerbColors = [];
    const kerbIndices = [];
    let kerbVertCount = 0;

    for (let i = 0; i <= SEGMENTS; i++) {
      const s = samples[i % SEGMENTS];
      const leftEdge = s.pt.clone().addScaledVector(s.right, -TRACK_HALF_WIDTH);
      const rightEdge = s.pt.clone().addScaledVector(s.right, TRACK_HALF_WIDTH);

      roadPositions.push(leftEdge.x, 0.04, leftEdge.z);
      roadPositions.push(rightEdge.x, 0.04, rightEdge.z);
      roadNormals.push(0, 1, 0, 0, 1, 0);

      const vCoord = (i / SEGMENTS) * 95;
      roadUvs.push(0, vCoord, 1, vCoord);

      if (i < SEGMENTS) {
        const base = i * 2;
        roadIndices.push(base, base + 1, base + 2);
        roadIndices.push(base + 1, base + 3, base + 2);
      }

      // Pianitos (Kerbs) en zonas de curva (donde speedHint < 0.86)
      if (i < SEGMENTS && s.speedHint < 0.86) {
        const sNext = samples[(i + 1) % SEGMENTS];
        const isRed = (i % 2 === 0);
        const cr = isRed ? 0.86 : 0.95;
        const cg = isRed ? 0.14 : 0.96;
        const cb = isRed ? 0.16 : 0.98;
        const kerbW = 1.05;

        [-1, 1].forEach((side) => {
          const offsetInner = side * (TRACK_HALF_WIDTH - 0.15);
          const offsetOuter = side * (TRACK_HALF_WIDTH + kerbW);

          const p1 = s.pt.clone().addScaledVector(s.right, offsetInner);
          const p2 = s.pt.clone().addScaledVector(s.right, offsetOuter);
          const p3 = sNext.pt.clone().addScaledVector(sNext.right, offsetInner);
          const p4 = sNext.pt.clone().addScaledVector(sNext.right, offsetOuter);

          kerbPositions.push(
            p1.x, 0.055, p1.z,
            p2.x, 0.085, p2.z,
            p3.x, 0.055, p3.z,
            p4.x, 0.085, p4.z
          );
          for (let k = 0; k < 4; k++) kerbColors.push(cr, cg, cb);

          if (side === 1) {
            kerbIndices.push(kerbVertCount, kerbVertCount + 2, kerbVertCount + 1);
            kerbIndices.push(kerbVertCount + 1, kerbVertCount + 2, kerbVertCount + 3);
          } else {
            kerbIndices.push(kerbVertCount, kerbVertCount + 1, kerbVertCount + 2);
            kerbIndices.push(kerbVertCount + 1, kerbVertCount + 3, kerbVertCount + 2);
          }
          kerbVertCount += 4;
        });
      }
    }

    const roadGeom = new THREE.BufferGeometry();
    roadGeom.setAttribute("position", new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeom.setAttribute("normal", new THREE.Float32BufferAttribute(roadNormals, 3));
    roadGeom.setAttribute("uv", new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeom.setIndex(roadIndices);

    const asphaltTex = createAsphaltTexture(isRain);
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: isRain ? 0.16 : 0.62,
      metalness: isRain ? 0.38 : 0.08,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.receiveShadow = true;
    roadMesh.renderOrder = 1;
    trackGroup.add(roadMesh);

    const kerbGeom = new THREE.BufferGeometry();
    kerbGeom.setAttribute("position", new THREE.Float32BufferAttribute(kerbPositions, 3));
    kerbGeom.setAttribute("color", new THREE.Float32BufferAttribute(kerbColors, 3));
    kerbGeom.setIndex(kerbIndices);
    kerbGeom.computeVertexNormals();
    const kerbMesh = new THREE.Mesh(
      kerbGeom,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2.5,
        polygonOffsetUnits: -2.5
      })
    );
    kerbMesh.receiveShadow = true;
    kerbMesh.renderOrder = 2;
    trackGroup.add(kerbMesh);

    // 4. Línea de Largada/Llegada a cuadros y Cajones blancos de Grilla
    const startSampleIndex = typeof trackDef.startSampleIndex === "number" ? trackDef.startSampleIndex : (isV2 ? 0 : 16);
    const startSample = samples[startSampleIndex];
    const startAngleY = Math.atan2(startSample.tan.x, startSample.tan.z);

    // Pórtico de largada con semáforos y cartel del circuito
    const gantryGroup = new THREE.Group();
    gantryGroup.position.copy(startSample.pt);
    gantryGroup.rotation.y = startAngleY;
    trackGroup.add(gantryGroup);

    // Línea a cuadros en el asfalto
    const checkCanvas = document.createElement("canvas");
    checkCanvas.width = 256;
    checkCanvas.height = 64;
    const cctx = checkCanvas.getContext("2d");
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 16; c++) {
        cctx.fillStyle = (r + c) % 2 === 0 ? "#FFFFFF" : "#14171C";
        cctx.fillRect(c * 16, r * 16, 16, 16);
      }
    }
    const startLineMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 1.92, 1.8),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(checkCanvas),
        polygonOffset: true,
        polygonOffsetFactor: -3.5,
        polygonOffsetUnits: -3.5
      })
    );
    startLineMesh.rotation.x = -Math.PI / 2;
    startLineMesh.position.y = 0.052;
    startLineMesh.renderOrder = 3;
    gantryGroup.add(startLineMesh);

    // Columnas y puente del pórtico
    const metalPillarMat = new THREE.MeshStandardMaterial({ color: "#CFD8DC", roughness: 0.35, metalness: 0.7 });
    [-TRACK_HALF_WIDTH - 1.2, TRACK_HALF_WIDTH + 1.2].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 6.8, 10), metalPillarMat);
      pillar.position.set(px, 3.4, 0);
      gantryGroup.add(pillar);
    });
    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry((TRACK_HALF_WIDTH + 1.4) * 2, 1.15, 0.55),
      new THREE.MeshStandardMaterial({ color: "#D51C24", roughness: 0.35 })
    );
    crossbar.position.set(0, 6.4, 0);
    gantryGroup.add(crossbar);

    // Cartel en el pórtico
    const bannerCanvas = document.createElement("canvas");
    bannerCanvas.width = 1024;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext("2d");
    bctx.fillStyle = "#C61820";
    bctx.fillRect(0, 0, 1024, 128);
    bctx.fillStyle = "#FFFFFF";
    bctx.font = "900 54px 'Segoe UI', Arial, sans-serif";
    bctx.textAlign = "center";
    bctx.textBaseline = "middle";
    bctx.fillText(isV2 ? "KARTÓDROMO INTERNACIONAL • V2" : "KARTÓDROMO CIUDAD DE BUENOS AIRES", 512, 66);
    const bannerPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 1.85, 1.05),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas) })
    );
    bannerPlane.position.set(0, 6.4, -0.29);
    bannerPlane.rotation.y = Math.PI;
    gantryGroup.add(bannerPlane);

    // Cajones blancos de largada pintados en el asfalto para los 8 corredores (como en la Imagen 1)
    const gridSlots = [];
    const whiteLineMat = new THREE.MeshBasicMaterial({
      color: 0xE6ECF2,
      polygonOffset: true,
      polygonOffsetFactor: -3.5,
      polygonOffsetUnits: -3.5
    });
    for (let rank = 0; rank < 8; rank++) {
      const row = Math.floor(rank / 2);
      const col = rank % 2; // 0 = izquierda, 1 = derecha
      const sampleIdx = (startSampleIndex - 5 - row * 4 + SEGMENTS) % SEGMENTS;
      const gs = samples[sampleIdx];
      const lateralOffset = (col === 0 ? -1 : 1) * 2.35 + (col === 1 ? -0.2 : 0.2);

      const pos = gs.pt.clone().addScaledVector(gs.right, lateralOffset);
      pos.y = 0.04;
      const heading = Math.atan2(gs.tan.x, gs.tan.z);

      // Pintar el cajón blanco en U sobre el asfalto (exacto a Imagen 1)
      const boxGroup = new THREE.Group();
      boxGroup.position.set(pos.x, 0.052, pos.z);
      boxGroup.rotation.y = heading;

      const frontBar = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.14), whiteLineMat);
      frontBar.rotation.x = -Math.PI / 2;
      frontBar.position.set(0, 0, 1.35);
      frontBar.renderOrder = 3;
      boxGroup.add(frontBar);

      [-0.98, 0.98].forEach((lx) => {
        const sideBar = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.6), whiteLineMat);
        sideBar.rotation.x = -Math.PI / 2;
        sideBar.position.set(lx, 0, 0.6);
        sideBar.renderOrder = 3;
        boxGroup.add(sideBar);
      });
      trackGroup.add(boxGroup);

      gridSlots.push({
        position: pos,
        heading,
        t: sampleIdx / SEGMENTS,
        lateralOffset
      });
    }

    // 5. Edificio de Boxes de 2 Plantas + Torre de Control Gris con Ventanas Rojas (Idéntico a Imagen 1)
    const pitAnchor = samples[(startSampleIndex - 8 + SEGMENTS) % SEGMENTS];
    const pitGroup = new THREE.Group();
    pitGroup.position.copy(pitAnchor.pt);
    pitGroup.rotation.y = Math.atan2(pitAnchor.tan.x, pitAnchor.tan.z);
    trackGroup.add(pitGroup);

    // Edificio de Boxes a la izquierda de la recta (Imagen 1)
    const pitBuilding = new THREE.Group();
    pitBuilding.position.set(-TRACK_HALF_WIDTH - 9.5, 0, 12);
    pitGroup.add(pitBuilding);

    const wallMat = new THREE.MeshStandardMaterial({ color: "#D8DDE3", roughness: 0.65 });
    const darkGlassMat = new THREE.MeshStandardMaterial({ color: "#1B222C", roughness: 0.15, metalness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#323842", roughness: 0.5 });

    // Base planta baja y balcón primer piso
    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(10, 4.2, 68), wallMat);
    baseBlock.position.set(0, 2.1, 0);
    pitBuilding.add(baseBlock);

    const upperBlock = new THREE.Mesh(new THREE.BoxGeometry(9.6, 3.8, 68), wallMat);
    upperBlock.position.set(-0.2, 6.1, 0);
    pitBuilding.add(upperBlock);

    // Ventanales oscuros y columnas blancas del primer piso
    const windowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 65), darkGlassMat);
    windowStrip.position.set(4.6, 6.0, 0);
    pitBuilding.add(windowStrip);

    for (let z = -30; z <= 30; z += 5) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.8, 0.55), wallMat);
      col.position.set(4.65, 6.1, z);
      pitBuilding.add(col);
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.6, 70), roofMat);
    roof.position.set(0, 8.2, 0);
    pitBuilding.add(roof);

    // Torre de Control elevada gris con marcos de ventana rojos a la derecha de la recta (Imagen 1)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(TRACK_HALF_WIDTH + 11.5, 0, 24);
    pitGroup.add(towerGroup);

    const towerMat = new THREE.MeshStandardMaterial({ color: "#6E7682", roughness: 0.5, metalness: 0.2 });
    const redFrameMat = new THREE.MeshStandardMaterial({ color: "#B71C1C", roughness: 0.4 });

    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.2, 3.8), towerMat);
    towerBase.position.set(0, 2.6, 0);
    towerGroup.add(towerBase);

    const towerCabin = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.2, 6.4), towerMat);
    towerCabin.position.set(-0.6, 6.4, 0);
    towerGroup.add(towerCabin);

    const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.45, 7.2), roofMat);
    towerRoof.position.set(-0.6, 8.2, 0);
    towerGroup.add(towerRoof);

    // Ventanales con marco rojo de la Torre de Control
    const towerWin = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.5, 6.6), darkGlassMat);
    towerWin.position.set(-0.6, 6.5, 0);
    towerGroup.add(towerWin);

    const redBandTop = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.18, 6.65), redFrameMat);
    redBandTop.position.set(-0.6, 7.25, 0);
    towerGroup.add(redBandTop);
    const redBandBot = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.18, 6.65), redFrameMat);
    redBandBot.position.set(-0.6, 5.75, 0);
    towerGroup.add(redBandBot);

    // 6. Barreras de Contención (Llantas Blancas de 3 de alto para V2, o Barreras clásicas para V1)
    if (trackDef.hasWhiteTireWalls) {
      // TRACK V2: RODEADA POR LLANTAS BLANCAS DE CONTENCIÓN (3 LLANTAS DE ALTO CADA PILA)
      const tireGeo = createTripleTireStackGeometry();
      const whiteTireMat = new THREE.MeshStandardMaterial({
        color: "#F4F7FB",
        roughness: 0.82,
        metalness: 0.05
      });

      const stepDist = 0.94; // separación continua entre centros de pilas (~94cm)
      const stackCountPerSide = Math.ceil(totalLength / stepDist);
      const totalStacks = stackCountPerSide * 2;
      const instancedTires = new THREE.InstancedMesh(tireGeo, whiteTireMat, totalStacks);
      instancedTires.castShadow = true;
      instancedTires.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let idx = 0;
      const barrierOffset = TRACK_HALF_WIDTH + 1.15; // 7.95m del centro (justo al borde del asfalto/pianitos)

      for (let j = 0; j < stackCountPerSide; j++) {
        const t = j / stackCountPerSide;
        const pt = spline.getPointAt(t);
        const tan = spline.getTangentAt(t).normalize();
        const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const angleY = Math.atan2(tan.x, tan.z);

        // Lado Izquierdo (-barrierOffset)
        const leftPos = pt.clone().addScaledVector(right, -barrierOffset);
        dummy.position.set(leftPos.x, 0.02, leftPos.z);
        dummy.rotation.set(0, angleY + (Math.sin(j * 3.7) * 0.22), 0);
        dummy.scale.set(1.0, 0.98 + (j % 3) * 0.02, 1.0);
        dummy.updateMatrix();
        instancedTires.setMatrixAt(idx++, dummy.matrix);

        // Lado Derecho (+barrierOffset)
        const rightPos = pt.clone().addScaledVector(right, barrierOffset);
        dummy.position.set(rightPos.x, 0.02, rightPos.z);
        dummy.rotation.set(0, angleY + (Math.cos(j * 4.1) * 0.22), 0);
        dummy.scale.set(1.0, 0.98 + ((j + 1) % 3) * 0.02, 1.0);
        dummy.updateMatrix();
        instancedTires.setMatrixAt(idx++, dummy.matrix);
      }
      instancedTires.instanceMatrix.needsUpdate = true;
      instancedTires.renderOrder = 4;
      trackGroup.add(instancedTires);
    } else {
      // Circuito clásico V1: Barreras de neumáticos rojos y blancos en curvas + conos
      const tireBarrierGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10);
      const redTireMat = new THREE.MeshStandardMaterial({ color: "#C62828", roughness: 0.7 });
      const whiteTireMat = new THREE.MeshStandardMaterial({ color: "#ECEFF1", roughness: 0.7 });
      const coneGeo = new THREE.ConeGeometry(0.24, 0.68, 10);
      const coneMat = new THREE.MeshStandardMaterial({ color: "#FF6D00", roughness: 0.4 });

      for (let i = 0; i < SEGMENTS; i += 6) {
        const s = samples[i];
        if (s.speedHint < 0.76) {
          const isRed = (i % 12 === 0);
          const barrierPos = s.pt.clone().addScaledVector(s.right, TRACK_HALF_WIDTH + 2.8);
          const tireStack = new THREE.Mesh(tireBarrierGeo, isRed ? redTireMat : whiteTireMat);
          tireStack.position.set(barrierPos.x, 0.52, barrierPos.z);
          trackGroup.add(tireStack);
        } else if (i % 36 === 0) {
          const conePos = s.pt.clone().addScaledVector(s.right, -TRACK_HALF_WIDTH - 0.85);
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.position.set(conePos.x, 0.34, conePos.z);
          trackGroup.add(cone);
        }
      }
    }

    // 7. Carteles numerados de las curvas
    const activeCornerLabels = trackDef.cornerLabels || window.TRACK_CORNER_LABELS;
    activeCornerLabels.forEach((cl) => {
      const wPos = pixelToWorld(cl.px, cl.py);
      const sign = createCornerSign(cl.num);
      sign.position.copy(wPos);
      // Orientar cartel mirando hacia la pista
      sign.lookAt(0, 2.2, 0);
      trackGroup.add(sign);
    });

    // 8. Dirigible "GO KART" en el cielo (como en la Imagen 2 de referencia) + Tribunas y Torres de Cámara
    const blimpGroup = new THREE.Group();
    blimpGroup.position.set(-45, 58, -65);
    const blimpBody = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 18),
      new THREE.MeshStandardMaterial({ color: "#1E3A8A", roughness: 0.35 })
    );
    blimpBody.scale.set(2.6, 0.85, 0.85);
    blimpGroup.add(blimpBody);

    const blimpStripe = new THREE.Mesh(
      new THREE.SphereGeometry(9.08, 24, 12),
      new THREE.MeshStandardMaterial({ color: "#FFD600", roughness: 0.3 })
    );
    blimpStripe.scale.set(2.61, 0.18, 0.87);
    blimpGroup.add(blimpStripe);
    trackGroup.add(blimpGroup);

    // Tribunas con público colorido y techo (Estilo Imagen 2) en sectores clave del circuito
    function createGrandstand(lengthZ) {
      const gsGroup = new THREE.Group();
      const structMat = new THREE.MeshStandardMaterial({ color: "#90A4AE", roughness: 0.5, metalness: 0.4 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.2, lengthZ), structMat);
      base.position.set(0, 2.1, 0);
      gsGroup.add(base);

      // Textura de público colorido en las gradas
      const crowdCanvas = document.createElement("canvas");
      crowdCanvas.width = 256;
      crowdCanvas.height = 64;
      const crCtx = crowdCanvas.getContext("2d");
      crCtx.fillStyle = "#263238";
      crCtx.fillRect(0, 0, 256, 64);
      const palette = ["#EF4444", "#3B82F6", "#FACC15", "#22C55E", "#F97316", "#EC4899", "#FFFFFF"];
      for (let i = 0; i < 450; i++) {
        crCtx.fillStyle = palette[i % palette.length];
        crCtx.fillRect((Math.random() * 256) | 0, (Math.random() * 58) | 0, 4, 5);
      }
      const crowdSlope = new THREE.Mesh(
        new THREE.PlaneGeometry(lengthZ - 1, 7.2),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(crowdCanvas), side: THREE.DoubleSide })
      );
      crowdSlope.rotation.y = Math.PI / 2;
      crowdSlope.rotation.x = -0.52;
      crowdSlope.position.set(2.2, 4.4, 0);
      gsGroup.add(crowdSlope);

      // Techo de la tribuna
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.35, lengthZ + 1), structMat);
      canopy.position.set(0.5, 8.2, 0);
      canopy.rotation.z = -0.08;
      gsGroup.add(canopy);

      return gsGroup;
    }

    [110, 270, 460, 610].forEach((idx) => {
      const s = samples[idx % SEGMENTS];
      const gs = createGrandstand(38);
      const pos = s.pt.clone().addScaledVector(s.right, TRACK_HALF_WIDTH + 13.5);
      gs.position.copy(pos);
      gs.rotation.y = Math.atan2(s.tan.x, s.tan.z) + Math.PI;
      trackGroup.add(gs);
    });

    // Postes de iluminación del circuito (Imagen 1)
    for (let i = 0; i < SEGMENTS; i += 60) {
      const s = samples[i];
      const polePos = s.pt.clone().addScaledVector(s.right, -TRACK_HALF_WIDTH - 5.5);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 12, 8), metalPillarMat);
      pole.position.set(polePos.x, 6, polePos.z);
      trackGroup.add(pole);

      const lampHead = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.25, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xFFF9C4 })
      );
      lampHead.position.set(polePos.x, 12, polePos.z);
      trackGroup.add(lampHead);
    }

    // Funciones utilitarias de consulta sobre la pista para Física e IA
    function getSampleAtT(t) {
      const normT = ((t % 1) + 1) % 1;
      const fIdx = normT * SEGMENTS;
      const i0 = Math.floor(fIdx) % SEGMENTS;
      const i1 = (i0 + 1) % SEGMENTS;
      const frac = fIdx - Math.floor(fIdx);

      const s0 = samples[i0];
      const s1 = samples[i1];
      const pt = s0.pt.clone().lerp(s1.pt, frac);
      const tan = s0.tan.clone().lerp(s1.tan, frac).normalize();
      const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const speedHint = THREE.MathUtils.lerp(s0.speedHint, s1.speedHint, frac);
      const optimalOffset = THREE.MathUtils.lerp(s0.optimalOffset, s1.optimalOffset, frac);
      const curvature = THREE.MathUtils.lerp(s0.curvature, s1.curvature, frac);

      return { t: normT, pt, tan, right, speedHint, optimalOffset, curvature };
    }

    function findClosestTrackPoint(worldPos, hintT) {
      let bestIdx = 0;
      let bestDistSq = Infinity;

      if (typeof hintT === "number" && !isNaN(hintT)) {
        const centerIdx = Math.floor((((hintT % 1) + 1) % 1) * SEGMENTS);
        const windowSize = 45;
        for (let d = -windowSize; d <= windowSize; d++) {
          const idx = (centerIdx + d + SEGMENTS) % SEGMENTS;
          const dx = worldPos.x - samples[idx].pt.x;
          const dz = worldPos.z - samples[idx].pt.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = idx;
          }
        }
      } else {
        for (let i = 0; i < SEGMENTS; i++) {
          const dx = worldPos.x - samples[i].pt.x;
          const dz = worldPos.z - samples[i].pt.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = i;
          }
        }
      }

      const s = samples[bestIdx];
      const rel = new THREE.Vector3(worldPos.x - s.pt.x, 0, worldPos.z - s.pt.z);
      const lateralOffset = rel.dot(s.right);
      const t = bestIdx / SEGMENTS;

      return {
        index: bestIdx,
        t,
        sample: s,
        lateralOffset,
        distFromTrackCenter: Math.abs(lateralOffset)
      };
    }

    function setWeatherMode(rainEnabled) {
      roadMat.map = createAsphaltTexture(rainEnabled);
      roadMat.roughness = rainEnabled ? 0.15 : 0.62;
      roadMat.metalness = rainEnabled ? 0.38 : 0.08;
      roadMat.needsUpdate = true;

      groundMesh.material.map = isV2 ? createDirtTexture(rainEnabled) : createGrassTexture(rainEnabled);
      groundMesh.material.roughness = rainEnabled ? (isV2 ? 0.72 : 0.65) : (isV2 ? 0.94 : 0.88);
      groundMesh.material.needsUpdate = true;
    }

    return {
      trackId,
      trackDef,
      hasWhiteTireWalls: Boolean(trackDef.hasWhiteTireWalls),
      trackGroup,
      spline,
      samples,
      SEGMENTS,
      totalLength,
      trackHalfWidth: TRACK_HALF_WIDTH,
      startSampleIndex,
      startT: startSampleIndex / SEGMENTS,
      gridSlots,
      blimpGroup,
      getSampleAtT,
      findClosestTrackPoint,
      worldToPixel,
      pixelToWorld,
      setWeatherMode
    };
  };
})();
