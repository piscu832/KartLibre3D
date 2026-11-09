// Constructor 3D de Karts a partir de Modelo-Karting/KART-FBX.obj (window.KART_MODEL_PARTS)
// Incluye libreas personalizadas (#1 a #8), piloto 3D anatómico con casco aerodinámico, HANS/arnés,
// guantes con dedos curvados y botas de competición, etiqueta flotante y volante con pantalla LCD MyChron.

(function () {
  const cachedGeometries = {};

  function decodeBase64ToBytes(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  function getPartGeometry(partName, uvMode, pivotOffset) {
    const cacheKey = partName + "_" + (uvMode || "none") + "_" + (pivotOffset ? pivotOffset.join(",") : "0");
    if (cachedGeometries[cacheKey]) return cachedGeometries[cacheKey];

    const part = window.KART_MODEL_PARTS && window.KART_MODEL_PARTS[partName];
    if (!part) return null;

    const vBytes = decodeBase64ToBytes(part.v);
    const iBytes = decodeBase64ToBytes(part.i);
    const i16 = new Int16Array(vBytes.buffer);
    const u16 = new Uint16Array(iBytes.buffer);

    const vCount = i16.length / 3;
    const positions = new Float32Array(i16.length);
    const px = pivotOffset ? pivotOffset[0] : 0;
    const py = pivotOffset ? pivotOffset[1] : 0;
    const pz = pivotOffset ? pivotOffset[2] : 0;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vCount; i++) {
      const x = i16[i * 3 + 0] * 0.001 - px;
      const y = i16[i * 3 + 1] * 0.001 - py;
      const z = i16[i * 3 + 2] * 0.001 - pz;
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(u16, 1));

    if (uvMode) {
      const uvs = new Float32Array(vCount * 2);
      const spanX = Math.max(0.001, maxX - minX);
      const spanY = Math.max(0.001, maxY - minY);
      const spanZ = Math.max(0.001, maxZ - minZ);
      for (let i = 0; i < vCount; i++) {
        const x = positions[i * 3 + 0];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        if (uvMode === "nassau" || uvMode === "spoiler") {
          uvs[i * 2 + 0] = (x - minX) / spanX;
          uvs[i * 2 + 1] = (z - minZ) / spanZ;
        } else if (uvMode === "sidepod") {
          uvs[i * 2 + 0] = (z - minZ) / spanZ;
          uvs[i * 2 + 1] = (y - minY) / spanY;
        }
      }
      geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    }

    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    cachedGeometries[cacheKey] = geom;
    return geom;
  }

  // Genera textura del panel frontal Nassau (con placa y dorsal numérico)
  function createNassauTexture(racer) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = racer.primaryColor;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = racer.secondaryColor;
    ctx.fillRect(0, 0, 38, 512);
    ctx.fillRect(512 - 38, 0, 38, 512);

    ctx.fillStyle = racer.stripeColor;
    ctx.fillRect(38, 0, 12, 512);
    ctx.fillRect(512 - 50, 0, 12, 512);

    ctx.save();
    ctx.translate(256, 155);
    ctx.beginPath();
    ctx.moveTo(-78, -68);
    ctx.lineTo(78, -68);
    ctx.quadraticCurveTo(92, 0, 68, 72);
    ctx.lineTo(-68, 72);
    ctx.quadraticCurveTo(-92, 0, -78, -68);
    ctx.closePath();

    ctx.fillStyle = "#F7F9FC";
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#181B20";
    ctx.stroke();

    ctx.scale(-1, -1);
    ctx.fillStyle = "#14171C";
    ctx.font = "italic 900 96px 'Segoe UI', Impact, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(racer.number), 0, 4);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  // Genera textura del spoiler delantero
  function createSpoilerTexture(racer) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = racer.primaryColor;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = racer.secondaryColor;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(145, 0); ctx.lineTo(95, 256); ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(512, 0); ctx.lineTo(512 - 145, 0); ctx.lineTo(512 - 95, 256); ctx.lineTo(512, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = racer.stripeColor;
    ctx.beginPath();
    ctx.moveTo(145, 0); ctx.lineTo(185, 0); ctx.lineTo(135, 256); ctx.lineTo(95, 256);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(512 - 145, 0); ctx.lineTo(512 - 185, 0); ctx.lineTo(512 - 135, 256); ctx.lineTo(512 - 95, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(175, 175, 162, 55);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  // Genera textura para los pontones laterales
  function createSidePodTexture(racer) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = racer.primaryColor;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = racer.secondaryColor;
    ctx.beginPath();
    ctx.moveTo(310, 0); ctx.lineTo(410, 0); ctx.lineTo(340, 256); ctx.lineTo(240, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = racer.stripeColor;
    ctx.beginPath();
    ctx.moveTo(275, 0); ctx.lineTo(310, 0); ctx.lineTo(240, 256); ctx.lineTo(205, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#F8FAFC";
    ctx.strokeStyle = "#14171A";
    ctx.lineWidth = 8;
    ctx.fillRect(42, 48, 108, 136);
    ctx.strokeRect(42, 48, 108, 136);

    ctx.save();
    ctx.translate(96, 116);
    ctx.fillStyle = "#14171A";
    ctx.font = "italic 900 84px 'Segoe UI', Impact, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(racer.number), 0, 0);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  let redSuedeTexture = null;
  function getRedSuedeTexture() {
    if (redSuedeTexture) return redSuedeTexture;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#9E2424";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(210,55,55,0.28)" : "rgba(70,10,10,0.32)";
      ctx.fillRect(x, y, 2, 2);
    }
    redSuedeTexture = new THREE.CanvasTexture(canvas);
    redSuedeTexture.wrapS = redSuedeTexture.wrapT = THREE.RepeatWrapping;
    return redSuedeTexture;
  }

  function createRacerNameSprite(racer) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(15, 20, 28, 0.75)";
    ctx.strokeStyle = racer.primaryColor;
    ctx.lineWidth = 5;
    const rx = 24, ry = 18, rw = 464, rh = 92, rad = 18;
    ctx.beginPath();
    ctx.moveTo(rx + rad, ry);
    ctx.lineTo(rx + rw - rad, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad);
    ctx.lineTo(rx + rw, ry + rh - rad);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh);
    ctx.lineTo(rx + rad, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad);
    ctx.lineTo(rx, ry + rad);
    ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const fx = 44, fy = 33, fw = 92, fh = 62;
    if (racer.flagType === "BR") {
      ctx.fillStyle = "#009B3A";
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = "#FEDF00";
      ctx.beginPath();
      ctx.moveTo(fx + fw / 2, fy + 8);
      ctx.lineTo(fx + fw - 10, fy + fh / 2);
      ctx.lineTo(fx + fw / 2, fy + fh - 8);
      ctx.lineTo(fx + 10, fy + fh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#002776";
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fh / 2, 13, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#74ACDF";
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(fx, fy + fh / 3, fw, fh / 3);
      ctx.fillStyle = "#F6B40E";
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fh / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, fw, fh);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 48px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 6;
    ctx.fillText("#" + racer.number + " " + racer.name, fx + fw + 22, fy + fh / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.65, 0.42, 1);
    sprite.position.set(0, 1.38, -0.15);
    return sprite;
  }

  // Helper para unir dos puntos 3D con un segmento orgánico redondeado (cápsula articulada)
  function createLimbSegment(pStart, pEnd, rStart, rEnd, material, radialSegs) {
    const dir = new THREE.Vector3().subVectors(pEnd, pStart);
    const len = dir.length();
    const geom = new THREE.CylinderGeometry(rEnd, rStart, len, radialSegs || 14, 4);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(pStart).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Construye el modelo 3D anatómico del corredor siguiendo la forma de la imagen de referencia:
  // Postura reclinada de karting, buzo acolchado, protector cervical HANS + arnés negro de 4 puntos,
  // casco integral esculpido con mentonera, tomas de aire y visor con bisagras laterales,
  // manos con dedos curvados y zapatillas de competición con suela negra y refuerzos laterales.
  function createDriverMesh(racer) {
    const driverGroup = new THREE.Group();

    const suitMat = new THREE.MeshStandardMaterial({
      color: racer.suitColor,
      roughness: 0.62,
      metalness: 0.06
    });
    const suitStripeMat = new THREE.MeshStandardMaterial({
      color: racer.suitAccent,
      roughness: 0.52,
      metalness: 0.08
    });
    const harnessMat = new THREE.MeshStandardMaterial({
      color: "#15171C",
      roughness: 0.55,
      metalness: 0.18
    });
    const buckleMat = new THREE.MeshStandardMaterial({
      color: "#CFD8DC",
      roughness: 0.25,
      metalness: 0.85
    });
    const shoeUpperMat = new THREE.MeshStandardMaterial({
      color: racer.suitAccent,
      roughness: 0.48,
      metalness: 0.1
    });
    const shoeSoleMat = new THREE.MeshStandardMaterial({
      color: "#121418",
      roughness: 0.75,
      metalness: 0.08
    });
    const gloveMat = new THREE.MeshStandardMaterial({
      color: racer.gloveColor,
      roughness: 0.58,
      metalness: 0.06
    });
    const glovePadMat = new THREE.MeshStandardMaterial({
      color: racer.gloveAccent,
      roughness: 0.38,
      metalness: 0.12
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: racer.helmetColor,
      roughness: 0.15,
      metalness: 0.22
    });
    const helmetStripeMat = new THREE.MeshStandardMaterial({
      color: racer.helmetStripe,
      roughness: 0.22,
      metalness: 0.2
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: "#090C10",
      roughness: 0.05,
      metalness: 0.90
    });
    const redPivotMat = new THREE.MeshStandardMaterial({
      color: "#D32F2F",
      roughness: 0.3,
      metalness: 0.5
    });

    // 1. Pelvis / Cadera anatómica asentada en la butaca (Seat center: X=0, Y=0.22, Z=-0.18)
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), suitMat);
    pelvis.scale.set(1.18, 0.82, 1.05);
    pelvis.position.set(0, 0.22, -0.17);
    pelvis.castShadow = true;
    driverGroup.add(pelvis);

    // Correas inferiores del arnés rodeando los muslos (como en la imagen de referencia)
    [-1, 1].forEach((side) => {
      const legStrap = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.014, 8, 16), harnessMat);
      legStrap.position.set(side * 0.095, 0.23, -0.05);
      legStrap.rotation.y = side * 0.2;
      legStrap.rotation.x = 0.35;
      driverGroup.add(legStrap);

      // Extremo suelto de correa colgando al costado de la cadera (detalle idéntico a la imagen)
      const strapTail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.028), harnessMat);
      strapTail.position.set(side * 0.165, 0.14, -0.10);
      strapTail.rotation.z = -side * 0.15;
      strapTail.rotation.x = 0.18;
      driverGroup.add(strapTail);
    });

    // 2. Piernas anatómicas reclinadas (Muslo -> Rodilla flexionada -> Pantorrilla -> Tobillo -> Zapatilla de karting)
    [-1, 1].forEach((side) => {
      const hipPt = new THREE.Vector3(side * 0.095, 0.22, -0.14);
      const kneePt = new THREE.Vector3(side * 0.098, 0.315, 0.19);
      const anklePt = new THREE.Vector3(side * 0.088, 0.245, 0.58);

      // Muslo con pliegues suaves
      const thigh = createLimbSegment(hipPt, kneePt, 0.084, 0.072, suitMat, 16);
      driverGroup.add(thigh);

      // Pliegues acolchados del buzo en el muslo
      for (let f = 1; f <= 3; f++) {
        const foldPos = new THREE.Vector3().lerpVectors(hipPt, kneePt, f * 0.25);
        const fold = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.006, 6, 14), suitMat);
        fold.position.copy(foldPos);
        fold.rotation.x = Math.PI * 0.42;
        driverGroup.add(fold);
      }

      // Rodilla redondeada
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.071, 14, 12), suitMat);
      knee.position.copy(kneePt);
      knee.castShadow = true;
      driverGroup.add(knee);

      // Pantorrilla hacia el pedal
      const calf = createLimbSegment(kneePt, anklePt, 0.070, 0.052, suitMat, 16);
      driverGroup.add(calf);

      // Puño negro de botamanga en el tobillo
      const ankleCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.045, 12), shoeSoleMat);
      ankleCuff.position.copy(anklePt);
      ankleCuff.rotation.x = Math.PI * 0.45;
      driverGroup.add(ankleCuff);

      // Zapatilla de competición esculpida (inclinada ~70° como en la imagen de referencia)
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(side * 0.088, 0.275, 0.655);
      shoeGroup.rotation.x = -0.32;
      shoeGroup.rotation.z = -side * 0.05;
      driverGroup.add(shoeGroup);

      // Cuerpo de la zapatilla
      const shoeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.21, 14), shoeUpperMat);
      shoeBody.scale.set(0.95, 1.0, 1.15);
      shoeBody.position.set(0, 0.03, 0);
      shoeGroup.add(shoeBody);

      // Puntera redondeada
      const shoeToe = new THREE.Mesh(new THREE.SphereGeometry(0.039, 12, 10), shoeUpperMat);
      shoeToe.scale.set(0.95, 0.85, 1.1);
      shoeToe.position.set(0, 0.135, 0);
      shoeGroup.add(shoeToe);

      // Suela plana negra antideslizante
      const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.24, 0.018), shoeSoleMat);
      shoeSole.position.set(0, 0.025, 0.038);
      shoeGroup.add(shoeSole);

      // Refuerzos laterales negros en talón y empeine (exactos a la imagen de referencia)
      const heelGuard = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.055, 0.052), shoeSoleMat);
      heelGuard.position.set(0, -0.055, 0.012);
      shoeGroup.add(heelGuard);

      const midStrap = new THREE.Mesh(new THREE.BoxGeometry(0.081, 0.032, 0.056), shoeSoleMat);
      midStrap.position.set(0, 0.045, 0.008);
      midStrap.rotation.x = 0.25;
      shoeGroup.add(midStrap);
    });

    // 3. Torso Superior Reclinado + Respaldo + HANS + Arnés de 4 puntos + Cabeza + Brazos
    const upperBody = new THREE.Group();
    upperBody.position.set(0, 0.23, -0.18);
    driverGroup.add(upperBody);

    // Abdomen y Tórax reclinados hacia atrás (~32° de reclinación como en la imagen)
    const waistPt = new THREE.Vector3(0, 0.02, 0.0);
    const chestPt = new THREE.Vector3(0, 0.29, -0.11);
    const neckBasePt = new THREE.Vector3(0, 0.39, -0.15);

    const torsoMesh = createLimbSegment(waistPt, chestPt, 0.135, 0.158, suitMat, 18);
    torsoMesh.scale.set(1.16, 1.0, 0.82);
    upperBody.add(torsoMesh);

    const upperChest = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), suitMat);
    upperChest.scale.set(1.22, 0.85, 0.82);
    upperChest.position.copy(chestPt);
    upperBody.add(upperChest);

    // Respaldo cervical acolchado negro del dispositivo HANS detrás de la nuca (igual a la imagen de referencia)
    const headRestPad = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.055, 16), harnessMat);
    headRestPad.scale.set(1.05, 1.0, 0.85);
    headRestPad.rotation.x = Math.PI / 2 - 0.25;
    headRestPad.position.set(0, 0.45, -0.22);
    upperBody.add(headRestPad);

    // Dispositivo HANS / Hombreras negras y Correas del Arnés de Competición con hebilla metálica
    [-1, 1].forEach((side) => {
      // Hombrera rígida del HANS sobre los hombros
      const hansYoke = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.042, 0.21), harnessMat);
      hansYoke.position.set(side * 0.105, 0.36, -0.09);
      hansYoke.rotation.x = 0.52;
      hansYoke.rotation.z = -side * 0.14;
      upperBody.add(hansYoke);

      // Correa pectoral bajando hacia la hebilla central
      const chestStrap = createLimbSegment(
        new THREE.Vector3(side * 0.10, 0.34, -0.03),
        new THREE.Vector3(side * 0.03, 0.11, 0.07),
        0.022,
        0.020,
        harnessMat,
        8
      );
      chestStrap.scale.set(1.4, 1.0, 0.45);
      upperBody.add(chestStrap);
    });

    // Hebilla metálica central del arnés en el abdomen
    const centerBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.052, 0.022), buckleMat);
    centerBuckle.position.set(0, 0.10, 0.08);
    centerBuckle.rotation.x = -0.35;
    upperBody.add(centerBuckle);

    // 4. Casco Integral Aerodinámico (con mentonera avanzada, visor oscuro con bisagras y ventilaciones)
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.505, -0.145);
    upperBody.add(helmetGroup);

    // Calota principal redondeada y alargada aerodinámicamente
    const helmetDome = new THREE.Mesh(new THREE.SphereGeometry(0.152, 24, 20), helmetMat);
    helmetDome.scale.set(0.94, 1.02, 1.16);
    helmetDome.castShadow = true;
    helmetGroup.add(helmetDome);

    // Mentonera esculpida proyectada hacia adelante (jaw/chin bar de la imagen de referencia)
    const chinBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.116, 0.125, 20, 1, false, -Math.PI * 0.55, Math.PI * 1.1),
      helmetMat
    );
    chinBar.scale.set(0.92, 1.0, 1.18);
    chinBar.position.set(0, -0.048, 0.028);
    helmetGroup.add(chinBar);

    // Borde inferior negro / goma de base del casco y toma de aire en la mentonera
    const helmetBaseRim = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.015, 10, 22), harnessMat);
    helmetBaseRim.scale.set(0.92, 1.15, 1.0);
    helmetBaseRim.rotation.x = Math.PI / 2 + 0.08;
    helmetBaseRim.position.set(0, -0.105, 0.012);
    helmetGroup.add(helmetBaseRim);

    const chinVent = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.018, 0.025), harnessMat);
    chinVent.position.set(0, -0.072, 0.165);
    helmetGroup.add(chinVent);

    // Franja decorativa del color del piloto
    const helmetAccentStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.144, 0.138, 0.028, 20), helmetStripeMat);
    helmetAccentStripe.scale.set(0.95, 1.0, 1.17);
    helmetAccentStripe.position.set(0, -0.042, 0.016);
    helmetGroup.add(helmetAccentStripe);

    // Visor oscuro envolvente con marco superior/inferior y tornillos/bisagras laterales
    const visorShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.143, 0.084, 22, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      visorMat
    );
    visorShield.scale.set(0.95, 1.0, 1.16);
    visorShield.position.set(0, 0.006, 0.022);
    helmetGroup.add(visorShield);

    // Bisagras laterales negras y punto rojo del visor (como en la imagen de referencia)
    [-1, 1].forEach((side) => {
      const hingePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 12), harnessMat);
      hingePlate.rotation.z = Math.PI / 2;
      hingePlate.position.set(side * 0.136, 0.006, 0.035);
      helmetGroup.add(hingePlate);

      const redClip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), redPivotMat);
      redClip.position.set(side * 0.138, -0.028, 0.01);
      helmetGroup.add(redClip);
    });

    // Tomas de aire superiores en la corona del casco
    [-0.035, 0.035].forEach((vx) => {
      const topVent = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.042), harnessMat);
      topVent.position.set(vx, 0.142, 0.045);
      topVent.rotation.x = 0.28;
      helmetGroup.add(topVent);
    });

    // 5. Brazos Anatómicos Flexionados y Guantes con Dedos Curvados al Volante
    const armsGroup = new THREE.Group();
    upperBody.add(armsGroup);

    const armRefs = [];
    [-1, 1].forEach((side) => {
      const armPivot = new THREE.Group();
      // Hombro redondeado
      armPivot.position.set(side * 0.175, 0.30, -0.09);
      armsGroup.add(armPivot);

      const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 12), suitMat);
      armPivot.add(shoulderBall);

      // Punto del codo flexionado hacia abajo y adelante
      const elbowLocal = new THREE.Vector3(side * 0.025, -0.055, 0.21);
      const upperArmSeg = createLimbSegment(new THREE.Vector3(0, 0, 0), elbowLocal, 0.058, 0.050, suitMat, 14);
      armPivot.add(upperArmSeg);

      const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.050, 12, 10), suitMat);
      elbowBall.position.copy(elbowLocal);
      armPivot.add(elbowBall);

      // Grupo del antebrazo y mano hacia el aro del volante
      const forearmGroup = new THREE.Group();
      forearmGroup.position.copy(elbowLocal);
      armPivot.add(forearmGroup);

      const wristLocal = new THREE.Vector3(-side * 0.055, 0.085, 0.24);
      const forearmSeg = createLimbSegment(new THREE.Vector3(0, 0, 0), wristLocal, 0.049, 0.040, suitMat, 14);
      forearmGroup.add(forearmSeg);

      // Guante de karting con puño (gauntlet), palma, nudillera y dedos curvados (como en la imagen de referencia)
      const handGroup = new THREE.Group();
      handGroup.position.copy(wristLocal);
      handGroup.rotation.z = -side * 0.25;
      handGroup.rotation.y = -side * 0.18;
      forearmGroup.add(handGroup);

      // Puño del guante sobre la muñeca
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.041, 0.055, 12), gloveMat);
      cuff.rotation.x = Math.PI * 0.42;
      cuff.position.set(0, -0.01, -0.025);
      handGroup.add(cuff);

      // Dorso / Palma del guante
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), gloveMat);
      palm.scale.set(0.78, 0.95, 1.15);
      palm.position.set(0, 0.008, 0.02);
      handGroup.add(palm);

      // Protector de nudillos azul/color (estilo Imagen 1)
      const knucklePad = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.048, 0.045), glovePadMat);
      knucklePad.position.set(side * 0.026, 0.01, 0.02);
      handGroup.add(knucklePad);

      // 4 dedos curvados hacia adentro (sujetando el aro del volante)
      for (let f = 0; f < 4; f++) {
        const fy = 0.028 - f * 0.015;
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.042, 8), gloveMat);
        finger.position.set(-side * 0.012, fy, 0.056);
        finger.rotation.z = Math.PI * 0.38 * side;
        finger.rotation.x = 0.35;
        handGroup.add(finger);
      }

      // Pulgar arqueado arriba
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.010, 0.038, 8), gloveMat);
      thumb.position.set(-side * 0.008, 0.042, 0.028);
      thumb.rotation.x = 0.55;
      thumb.rotation.z = side * 0.45;
      handGroup.add(thumb);

      armRefs.push({ side, armPivot, forearmGroup, handGroup });
    });

    return {
      driverGroup,
      upperBody,
      helmetGroup,
      armRefs
    };
  }

  // Crea la pantalla digital LCD (MyChron) sobre el volante como en la 1ª imagen de referencia
  function createSteeringLCD() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const housingGroup = new THREE.Group();

    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.105, 0.026),
      new THREE.MeshStandardMaterial({ color: "#15181E", roughness: 0.45, metalness: 0.2 })
    );
    housingGroup.add(caseMesh);

    const shiftLedMat = new THREE.MeshBasicMaterial({ color: "#551111" });
    const shiftLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), shiftLedMat);
    shiftLed.position.set(0, 0.040, 0.014);
    housingGroup.add(shiftLed);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.105, 0.064),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    screenMesh.position.set(0, -0.002, 0.014);
    housingGroup.add(screenMesh);

    function updateLCD(speedKmh, rpmNorm, gear, lapTimeSec) {
      ctx.fillStyle = "#DCE4E8";
      ctx.fillRect(0, 0, 256, 160);

      ctx.strokeStyle = "#2A3035";
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, 248, 152);

      const bars = 16;
      const activeBars = Math.round(rpmNorm * bars);
      for (let i = 0; i < bars; i++) {
        ctx.fillStyle = i < activeBars ? "#11161B" : "rgba(0,0,0,0.12)";
        ctx.fillRect(14 + i * 14, 12, 10, 18);
      }

      ctx.fillStyle = "#101418";
      ctx.font = "900 68px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(gear), 14, 34);

      ctx.font = "800 42px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.round(speedKmh)), 125, 52);
      ctx.font = "700 15px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("KM/H", 125, 94);

      const tempVal = Math.round(158 + rpmNorm * 18);
      ctx.font = "800 32px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(tempVal), 22, 112);

      ctx.font = "700 18px Consolas, monospace";
      ctx.textAlign = "right";
      const mins = Math.floor(lapTimeSec / 60);
      const secs = (lapTimeSec % 60).toFixed(1).padStart(4, "0");
      ctx.fillText(mins + ":" + secs, 242, 118);

      for (let j = 0; j < 5; j++) {
        ctx.fillRect(226, 38 + j * 13, 16, 7);
      }

      shiftLedMat.color.setHex(rpmNorm > 0.88 ? 0xFF1E1E : 0x441111);
      texture.needsUpdate = true;
    }

    updateLCD(0, 0.2, 1, 0);
    return { housingGroup, updateLCD };
  }

  window.createKartInstance = function (racer, options) {
    options = options || {};
    const root = new THREE.Group();

    const chassisTiltGroup = new THREE.Group();
    root.add(chassisTiltGroup);

    const nassauTex = createNassauTexture(racer);
    const spoilerTex = createSpoilerTexture(racer);
    const sidePodTex = createSidePodTexture(racer);

    const matNassau = new THREE.MeshStandardMaterial({
      map: nassauTex,
      roughness: 0.26,
      metalness: 0.12,
      side: THREE.DoubleSide
    });
    const matSpoiler = new THREE.MeshStandardMaterial({
      map: spoilerTex,
      roughness: 0.28,
      metalness: 0.12,
      side: THREE.DoubleSide
    });
    const matSidePod = new THREE.MeshStandardMaterial({
      map: sidePodTex,
      roughness: 0.28,
      metalness: 0.12,
      side: THREE.DoubleSide
    });
    const matPrimaryBody = new THREE.MeshStandardMaterial({
      color: racer.primaryColor,
      roughness: 0.30,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    const matSecondaryAccent = new THREE.MeshStandardMaterial({
      color: racer.secondaryColor,
      roughness: 0.35,
      metalness: 0.20,
      side: THREE.DoubleSide
    });
    const matWhiteChassis = new THREE.MeshStandardMaterial({
      color: "#EEF2F7",
      roughness: 0.25,
      metalness: 0.45,
      side: THREE.DoubleSide
    });
    const matDarkMetal = new THREE.MeshStandardMaterial({
      color: "#262B33",
      roughness: 0.42,
      metalness: 0.72,
      side: THREE.DoubleSide
    });
    const matSilverAluminum = new THREE.MeshStandardMaterial({
      color: "#B8C4CE",
      roughness: 0.28,
      metalness: 0.82,
      side: THREE.DoubleSide
    });
    const matRadiatorBlue = new THREE.MeshStandardMaterial({
      color: "#7BA7CC",
      roughness: 0.32,
      metalness: 0.65,
      side: THREE.DoubleSide
    });
    const matSeatBlack = new THREE.MeshStandardMaterial({
      color: "#171A20",
      roughness: 0.55,
      metalness: 0.12,
      side: THREE.DoubleSide
    });
    const matMatteBlack = new THREE.MeshStandardMaterial({
      color: "#1B1E24",
      roughness: 0.68,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    const matTireRubber = new THREE.MeshStandardMaterial({
      color: "#16181C",
      roughness: 0.38,
      metalness: 0.08,
      side: THREE.DoubleSide
    });
    const matRimAlloy = new THREE.MeshStandardMaterial({
      color: "#22262E",
      roughness: 0.25,
      metalness: 0.80,
      side: THREE.DoubleSide
    });
    const matRedSuede = new THREE.MeshStandardMaterial({
      map: getRedSuedeTexture(),
      roughness: 0.85,
      metalness: 0.04,
      side: THREE.DoubleSide
    });

    function addStaticPart(partName, material, uvMode) {
      const geom = getPartGeometry(partName, uvMode, null);
      if (!geom) return null;
      const mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      chassisTiltGroup.add(mesh);
      return mesh;
    }

    addStaticPart("NassauPanel", matNassau, "nassau");
    addStaticPart("FrontSpoiler", matSpoiler, "spoiler");
    addStaticPart("Object017", matSidePod, "sidepod");
    addStaticPart("Object018", matSidePod, "sidepod");
    addStaticPart("Object015", matPrimaryBody);
    addStaticPart("Object001", matPrimaryBody);
    addStaticPart("Object002", matSecondaryAccent);
    addStaticPart("Object028", matDarkMetal);
    addStaticPart("RearBumperWide", matMatteBlack);

    addStaticPart("ChassisFrame", matWhiteChassis);
    addStaticPart("Seat", matSeatBlack);
    addStaticPart("EngineBlock", matDarkMetal);
    addStaticPart("Object024", matRadiatorBlue);
    addStaticPart("Object026", matMatteBlack);
    addStaticPart("Object008", matMatteBlack);
    addStaticPart("Object010", matDarkMetal);
    addStaticPart("Object011", matMatteBlack);
    addStaticPart("Object013", matSilverAluminum);
    addStaticPart("Object014", matSilverAluminum);
    addStaticPart("Object019", matSilverAluminum);
    addStaticPart("Object021", matDarkMetal);
    addStaticPart("Object022", matSilverAluminum);
    addStaticPart("SteeringAndAxles", matDarkMetal);
    addStaticPart("Object025", matMatteBlack);
    addStaticPart("Rim_FL", matDarkMetal);
    addStaticPart("Rim_FR", matDarkMetal);
    addStaticPart("Rim_RL", matDarkMetal);
    addStaticPart("Rim_RR", matDarkMetal);
    addStaticPart("Hub_FL", matSilverAluminum);
    addStaticPart("Hub_RL", matSilverAluminum);

    const knobGroup = new THREE.Group();
    knobGroup.position.set(0, 0.42, 0.34);
    const knobPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.06), matWhiteChassis);
    knobGroup.add(knobPlate);
    const redCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.020, 0.024, 12),
      new THREE.MeshStandardMaterial({ color: "#D51C24", roughness: 0.3 })
    );
    redCap.position.set(0.025, 0.025, 0);
    knobGroup.add(redCap);
    const smallSwitch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.010, 0.012, 0.02, 10),
      new THREE.MeshStandardMaterial({ color: "#D51C24", roughness: 0.3 })
    );
    smallSwitch.position.set(-0.025, 0.022, 0);
    knobGroup.add(smallSwitch);
    chassisTiltGroup.add(knobGroup);

    // 3. Volante animado sobre su plano real (inclinación +0.68 rad en X para que gire sobre su propio plano)
    const steerPivotPos = [0.000, 0.567, 0.240];
    const steeringColumnGroup = new THREE.Group();
    steeringColumnGroup.position.set(steerPivotPos[0], steerPivotPos[1], steerPivotPos[2]);
    steeringColumnGroup.rotation.x = 0.68;
    chassisTiltGroup.add(steeringColumnGroup);

    const steeringWheelSpinGroup = new THREE.Group();
    steeringColumnGroup.add(steeringWheelSpinGroup);

    const wheelCounterRot = new THREE.Group();
    wheelCounterRot.rotation.x = -0.68;
    steeringWheelSpinGroup.add(wheelCounterRot);

    const geomSteerWheel = getPartGeometry("Object007", null, steerPivotPos);
    if (geomSteerWheel) {
      const meshSteer = new THREE.Mesh(geomSteerWheel, matRedSuede);
      meshSteer.castShadow = true;
      wheelCounterRot.add(meshSteer);
    }
    const geomSteerHub = getPartGeometry("Object009", null, steerPivotPos);
    if (geomSteerHub) {
      const meshHub = new THREE.Mesh(geomSteerHub, matSilverAluminum);
      wheelCounterRot.add(meshHub);
    }

    const lcd = createSteeringLCD();
    lcd.housingGroup.position.set(0.002, 0.068, 0.018);
    lcd.housingGroup.rotation.y = Math.PI;
    lcd.housingGroup.rotation.x = 0.25;
    wheelCounterRot.add(lcd.housingGroup);

    // 4. Las 4 Ruedas independientes
    const wheelConfigs = [
      { id: "FL", tire: "Tire_FL", pivot: [-0.692, 0.173,  0.733], isFront: true },
      { id: "FR", tire: "Tire_FR", pivot: [ 0.692, 0.173,  0.733], isFront: true },
      { id: "RL", tire: "Tire_RL", pivot: [-0.686, 0.189, -0.733], isFront: false },
      { id: "RR", tire: "Tire_RR", pivot: [ 0.693, 0.189, -0.733], isFront: false }
    ];

    const wheels = {};
    wheelConfigs.forEach((wc) => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wc.pivot[0], wc.pivot[1], wc.pivot[2]);
      root.add(steerGroup);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const tireGeom = getPartGeometry(wc.tire, null, wc.pivot);
      if (tireGeom) {
        const tm = new THREE.Mesh(tireGeom, matTireRubber);
        tm.castShadow = true;
        tm.receiveShadow = true;
        spinGroup.add(tm);
      }

      const wheelRimMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, wc.isFront ? 0.17 : 0.22, 14),
        matRimAlloy
      );
      wheelRimMesh.rotation.z = Math.PI / 2;
      spinGroup.add(wheelRimMesh);

      wheels[wc.id] = { steerGroup, spinGroup, isFront: wc.isFront };
    });

    // 5. Piloto 3D Anatómico en la butaca
    const driver = createDriverMesh(racer);
    chassisTiltGroup.add(driver.driverGroup);

    // 6. Cartel flotante con Bandera + Nombre del corredor
    const nameSprite = createRacerNameSprite(racer);
    if (options.hideNameTag) {
      nameSprite.visible = false;
    }
    root.add(nameSprite);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 2.55),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.015;
    root.add(shadowPlane);

    let wheelSpinAngle = 0;
    function updateVisuals(dt, state) {
      const speed = state.speed || 0;
      const steer = state.steerAngle || 0;

      wheelSpinAngle += (speed * dt) / 0.18;
      Object.values(wheels).forEach((w) => {
        if (w.isFront) {
          w.steerGroup.rotation.y = steer * 0.72;
        }
        w.spinGroup.rotation.x = wheelSpinAngle;
      });

      const wheelRot = -steer * 1.45;
      steeringWheelSpinGroup.rotation.z = wheelRot;

      const targetRoll = THREE.MathUtils.clamp(-steer * (speed / 28) * 0.055, -0.055, 0.055);
      const targetPitch = THREE.MathUtils.clamp((state.accelG || 0) * 0.022, -0.038, 0.038);
      const targetSlipYaw = THREE.MathUtils.clamp(state.slipAngle || 0, -0.28, 0.28);
      chassisTiltGroup.rotation.z = THREE.MathUtils.lerp(chassisTiltGroup.rotation.z, targetRoll, dt * 10);
      chassisTiltGroup.rotation.x = THREE.MathUtils.lerp(chassisTiltGroup.rotation.x, targetPitch, dt * 10);
      chassisTiltGroup.rotation.y = THREE.MathUtils.lerp(chassisTiltGroup.rotation.y, targetSlipYaw, dt * 9);

      driver.upperBody.rotation.z = THREE.MathUtils.lerp(driver.upperBody.rotation.z, steer * 0.18, dt * 8);
      driver.helmetGroup.rotation.z = steer * 0.15;
      driver.helmetGroup.rotation.y = steer * 0.25;

      driver.armRefs.forEach((a) => {
        const lift = a.side * steer * 0.22;
        a.armPivot.rotation.x = lift;
        a.forearmGroup.rotation.z = -steer * 0.30;
      });

      const isFP = Boolean(state.isFirstPerson);
      driver.helmetGroup.visible = !isFP;
      if (!options.hideNameTag) {
        nameSprite.visible = !isFP;
      }

      lcd.updateLCD(Math.abs(speed) * 3.6, state.rpmNorm || 0.25, state.gear || 1, state.lapTimeSec || 0);
    }

    return {
      root,
      chassisTiltGroup,
      steeringColumnGroup,
      driver,
      nameSprite,
      updateVisuals
    };
  };
})();
