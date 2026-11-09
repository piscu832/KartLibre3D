// Generador 3D del Circuito "Kartódromo Ciudad de Buenos Aires" (basado en Pistas/Kartódromo-V1.jpeg)
// Incluye el edificio de boxes y torre de control de la Imagen 1 + barreras de neumáticos y tribunas de la Imagen 2.

(function () {
  const PIXEL_SCALE = 0.34;
  const CENTER_PX = 800;
  const CENTER_PY = 520;
  const TRACK_HALF_WIDTH = 6.8; // 13.6m de ancho total para permitir sobrepasos entre los 8 karts

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

  // Textura de pasto / césped húmedo
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

  window.buildKartodromoTrack = function (scene, isRain) {
    const trackGroup = new THREE.Group();
    scene.add(trackGroup);

    // 1. Construir curva cerrada CatmullRomCurve3 a partir de los puntos de Kartódromo-V1.jpeg
    const rawPts = window.TRACK_PIXEL_POINTS.map((p) => pixelToWorld(p.px, p.py));
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

      // Interpolación de speedHint desde los puntos originales
      const rawIdx = Math.floor(t * window.TRACK_PIXEL_POINTS.length) % window.TRACK_PIXEL_POINTS.length;
      const nextRawIdx = (rawIdx + 1) % window.TRACK_PIXEL_POINTS.length;
      const localFrac = (t * window.TRACK_PIXEL_POINTS.length) - Math.floor(t * window.TRACK_PIXEL_POINTS.length);
      const sh = THREE.MathUtils.lerp(
        window.TRACK_PIXEL_POINTS[rawIdx].speedHint,
        window.TRACK_PIXEL_POINTS[nextRawIdx].speedHint,
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

    // 2. Terreno de césped exterior e interior
    const grassTex = createGrassTexture(isRain);
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({
        map: grassTex,
        roughness: isRain ? 0.65 : 0.88,
        metalness: 0.04
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.04;
    groundMesh.receiveShadow = true;
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

      roadPositions.push(leftEdge.x, 0.02, leftEdge.z);
      roadPositions.push(rightEdge.x, 0.02, rightEdge.z);
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
            p1.x, 0.035, p1.z,
            p2.x, 0.055, p2.z,
            p3.x, 0.035, p3.z,
            p4.x, 0.055, p4.z
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
      side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.receiveShadow = true;
    trackGroup.add(roadMesh);

    const kerbGeom = new THREE.BufferGeometry();
    kerbGeom.setAttribute("position", new THREE.Float32BufferAttribute(kerbPositions, 3));
    kerbGeom.setAttribute("color", new THREE.Float32BufferAttribute(kerbColors, 3));
    kerbGeom.setIndex(kerbIndices);
    kerbGeom.computeVertexNormals();
    const kerbMesh = new THREE.Mesh(
      kerbGeom,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide })
    );
    kerbMesh.receiveShadow = true;
    trackGroup.add(kerbMesh);

    // 4. Línea de Largada/Llegada a cuadros y Cajones blancos de Grilla (exacto a Imagen 1)
    const startSampleIndex = 16; // Recta Principal antes de Curva 1
    const startSample = samples[startSampleIndex];
    const startAngleY = Math.atan2(startSample.tan.x, startSample.tan.z);

    // Pórtico de largada con semáforos y cartel "KARTÓDROMO CIUDAD DE BUENOS AIRES"
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
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(checkCanvas), polygonOffset: true, polygonOffsetFactor: -2 })
    );
    startLineMesh.rotation.x = -Math.PI / 2;
    startLineMesh.position.y = 0.032;
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
    bctx.fillText("KARTÓDROMO CIUDAD DE BUENOS AIRES", 512, 66);
    const bannerPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 1.85, 1.05),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas) })
    );
    bannerPlane.position.set(0, 6.4, -0.29);
    bannerPlane.rotation.y = Math.PI;
    gantryGroup.add(bannerPlane);

    // Cajones blancos de largada pintados en el asfalto para los 8 corredores (como en la Imagen 1)
    const gridSlots = [];
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xE6ECF2 });
    for (let rank = 0; rank < 8; rank++) {
      const row = Math.floor(rank / 2);
      const col = rank % 2; // 0 = izquierda, 1 = derecha
      const sampleIdx = (startSampleIndex - 5 - row * 4 + SEGMENTS) % SEGMENTS;
      const gs = samples[sampleIdx];
      const lateralOffset = (col === 0 ? -1 : 1) * 2.35 + (col === 1 ? -0.2 : 0.2);

      const pos = gs.pt.clone().addScaledVector(gs.right, lateralOffset);
      const heading = Math.atan2(gs.tan.x, gs.tan.z);

      // Pintar el cajón blanco en U sobre el asfalto (exacto a Imagen 1)
      const boxGroup = new THREE.Group();
      boxGroup.position.set(pos.x, 0.032, pos.z);
      boxGroup.rotation.y = heading;

      const frontBar = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.14), whiteLineMat);
      frontBar.rotation.x = -Math.PI / 2;
      frontBar.position.set(0, 0, 1.35);
      boxGroup.add(frontBar);

      [-0.98, 0.98].forEach((lx) => {
        const sideBar = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.6), whiteLineMat);
        sideBar.rotation.x = -Math.PI / 2;
        sideBar.position.set(lx, 0, 0.6);
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

    // 6. Barreras de Neumáticos Rojos y Blancos en las curvas + Conos Naranjas (Imagen 1 y 2)
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

    // 7. Carteles de las 10 Curvas en sus coordenadas de Kartódromo-V1.jpeg
    window.TRACK_CORNER_LABELS.forEach((cl) => {
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

      groundMesh.material.map = createGrassTexture(rainEnabled);
      groundMesh.material.roughness = rainEnabled ? 0.65 : 0.88;
      groundMesh.material.needsUpdate = true;
    }

    return {
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
      setWeatherMode
    };
  };
})();
