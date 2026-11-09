// Gestor de Multijugador Online P2P (WebRTC PeerJS + BroadcastChannel local)
// - Salas de hasta 8 jugadores sincronizados en la misma carrera
// - Bloqueo exclusivo de personajes: NO se pueden repetir corredores (ej. sólo 1 Ayrton por sala)
// - Validación estricta de paquetes para seguridad anti-manipulación y cero XSS

(function () {
  const ROOM_PREFIX = "kartlibre3d-room-";
  const VALID_RACER_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const VALID_STAGES = ["RECON", "QUALY", "RACE"];
  const VALID_DIFFS = ["EASY", "MEDIUM", "HARD"];

  function isFiniteNum(n) {
    return typeof n === "number" && Number.isFinite(n);
  }

  function clampNum(n, min, max, fallback) {
    if (!isFiniteNum(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function sanitizeRoomCode(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/^KART-?/i, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
  }

  function generateRoomCode() {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    const arr = new Uint32Array(4);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
      for (let i = 0; i < 4; i++) {
        code += chars[arr[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return code;
  }

  window.createNetworkManager = function (callbacks) {
    let mode = "OFFLINE"; // "OFFLINE" | "HOST" | "CLIENT"
    let roomCode = "";
    let myPeerId = "";
    let peer = null;
    let hostConn = null;
    const clientConns = new Map(); // peerId -> DataConnection
    let bcChannel = null;

    // Mapa exclusivo: racerId (1..8) -> peerId propietario
    // Garantiza que jamás existan 2 jugadores con el mismo corredor
    let claimedRacers = {};
    let lastBroadcastTime = 0;

    function getMyRacerId() {
      for (const rId of VALID_RACER_IDS) {
        if (claimedRacers[rId] === myPeerId) return rId;
      }
      return null;
    }

    function getFirstFreeRacerId(preferredId) {
      if (VALID_RACER_IDS.includes(preferredId) && !claimedRacers[preferredId]) {
        return preferredId;
      }
      for (const rId of VALID_RACER_IDS) {
        if (!claimedRacers[rId]) return rId;
      }
      return null;
    }

    function getConnectedCount() {
      return Object.keys(claimedRacers).length;
    }

    function cleanupConnections() {
      clientConns.forEach((conn) => {
        try { conn.close(); } catch (e) {}
      });
      clientConns.clear();
      if (hostConn) {
        try { hostConn.close(); } catch (e) {}
        hostConn = null;
      }
      if (peer) {
        try { peer.destroy(); } catch (e) {}
        peer = null;
      }
      if (bcChannel) {
        try { bcChannel.close(); } catch (e) {}
        bcChannel = null;
      }
      claimedRacers = {};
      roomCode = "";
      myPeerId = "";
      mode = "OFFLINE";
    }

    function sendToPeer(targetPeerId, payload) {
      const conn = clientConns.get(targetPeerId);
      if (conn && conn.open) {
        try { conn.send(payload); } catch (e) {}
      }
      if (bcChannel) {
        try {
          bcChannel.postMessage({ _target: targetPeerId, _from: myPeerId, payload });
        } catch (e) {}
      }
    }

    function broadcastFromHost(payload) {
      if (mode !== "HOST") return;
      clientConns.forEach((conn) => {
        if (conn && conn.open) {
          try { conn.send(payload); } catch (e) {}
        }
      });
      if (bcChannel) {
        try {
          bcChannel.postMessage({ _target: "*", _from: myPeerId, payload });
        } catch (e) {}
      }
    }

    function sendToHost(payload) {
      if (mode !== "CLIENT") return;
      if (hostConn && hostConn.open) {
        try { hostConn.send(payload); } catch (e) {}
      }
      if (bcChannel) {
        try {
          bcChannel.postMessage({ _target: "HOST", _from: myPeerId, payload });
        } catch (e) {}
      }
    }

    function sanitizeKartPacket(raw) {
      if (!raw || typeof raw !== "object") return null;
      const rId = parseInt(raw.racerId, 10);
      if (!VALID_RACER_IDS.includes(rId)) return null;
      return {
        racerId: rId,
        x: clampNum(raw.x, -600, 600, 0),
        z: clampNum(raw.z, -600, 600, 0),
        heading: clampNum(raw.heading, -Math.PI * 4, Math.PI * 4, 0),
        speed: clampNum(raw.speed, -15, 42, 0),
        steerAngle: clampNum(raw.steerAngle, -0.6, 0.6, 0),
        slipAngle: clampNum(raw.slipAngle, -0.6, 0.6, 0),
        trackT: clampNum(raw.trackT, 0, 1, 0),
        lateralOffset: clampNum(raw.lateralOffset, -12, 12, 0),
        lap: Math.round(clampNum(raw.lap, 1, 99, 1)),
        passedHalfway: Boolean(raw.passedHalfway),
        finished: Boolean(raw.finished),
        finishTime: clampNum(raw.finishTime, 0, 36000, 0),
        bestLapTime: isFiniteNum(raw.bestLapTime) && raw.bestLapTime > 5 ? clampNum(raw.bestLapTime, 5, 3600, null) : null,
        lastLapTime: isFiniteNum(raw.lastLapTime) && raw.lastLapTime > 5 ? clampNum(raw.lastLapTime, 5, 3600, null) : null,
        totalProgress: clampNum(raw.totalProgress, -1, 100, 0)
      };
    }

    function broadcastRosterSync() {
      if (mode !== "HOST") return;
      const stateInfo = callbacks.getHostLobbySettings ? callbacks.getHostLobbySettings() : {};
      const msg = {
        type: "ROSTER_SYNC",
        roomCode,
        claimedRacers: Object.assign({}, claimedRacers),
        difficulty: VALID_DIFFS.includes(stateInfo.difficulty) ? stateInfo.difficulty : "MEDIUM",
        isRainMode: Boolean(stateInfo.isRainMode),
        gridOrderIds: Array.isArray(stateInfo.gridOrderIds) ? stateInfo.gridOrderIds : VALID_RACER_IDS
      };
      broadcastFromHost(msg);
      if (callbacks.onRosterUpdated) {
        callbacks.onRosterUpdated(claimedRacers, myPeerId, mode, roomCode, msg);
      }
    }

    function removePeerClaims(peerId) {
      let changed = false;
      for (const rId of VALID_RACER_IDS) {
        if (claimedRacers[rId] === peerId) {
          delete claimedRacers[rId];
          changed = true;
        }
      }
      return changed;
    }

    function handleHostIncomingMessage(fromPeerId, data) {
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;
      const safePeerId = String(fromPeerId || data.peerId || "").slice(0, 48);
      if (!safePeerId || safePeerId === "HOST") return;

      if (data.type === "JOIN_REQ") {
        // Si ya tenía un corredor asignado (reconexión), mantenerlo; si no, buscar uno libre
        let currentOwned = null;
        for (const rId of VALID_RACER_IDS) {
          if (claimedRacers[rId] === safePeerId) {
            currentOwned = rId;
            break;
          }
        }
        if (currentOwned === null) {
          if (getConnectedCount() >= 8) {
            sendToPeer(safePeerId, {
              type: "JOIN_REJECT",
              reason: "La sala está llena (los 8 corredores ya están ocupados)."
            });
            return;
          }
          const pref = parseInt(data.preferredRacerId, 10);
          const assigned = getFirstFreeRacerId(pref);
          if (assigned === null) {
            sendToPeer(safePeerId, {
              type: "JOIN_REJECT",
              reason: "No quedan corredores libres en esta sala."
            });
            return;
          }
          claimedRacers[assigned] = safePeerId;
        }
        broadcastRosterSync();
      } else if (data.type === "CLAIM_RACER") {
        const reqRacerId = parseInt(data.racerId, 10);
        if (!VALID_RACER_IDS.includes(reqRacerId)) return;
        // Solo se permite elegir si el corredor está 100% libre
        if (!claimedRacers[reqRacerId]) {
          removePeerClaims(safePeerId);
          claimedRacers[reqRacerId] = safePeerId;
          broadcastRosterSync();
        } else {
          // Reenviar estado actual si intentó elegir uno ya ocupado
          broadcastRosterSync();
        }
      } else if (data.type === "LEAVE_ROOM") {
        if (removePeerClaims(safePeerId)) {
          broadcastRosterSync();
        }
      } else if (data.type === "PLAYER_STATE") {
        const pkt = sanitizeKartPacket(data.kart);
        if (!pkt) return;
        // Verificar que ese peer sea realmente el dueño de ese corredor
        if (claimedRacers[pkt.racerId] !== safePeerId) return;
        if (callbacks.onClientKartState) {
          callbacks.onClientKartState(pkt);
        }
      }
    }

    function handleClientIncomingMessage(data) {
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;

      if (data.type === "JOIN_REJECT") {
        const reason = String(data.reason || "No se pudo unir a la sala.").slice(0, 140);
        cleanupConnections();
        if (callbacks.onStatusChange) {
          callbacks.onStatusChange("OFFLINE", "", reason, true);
        }
      } else if (data.type === "ROSTER_SYNC") {
        if (data.claimedRacers && typeof data.claimedRacers === "object") {
          const cleanClaims = {};
          for (const rId of VALID_RACER_IDS) {
            if (typeof data.claimedRacers[rId] === "string") {
              cleanClaims[rId] = data.claimedRacers[rId].slice(0, 48);
            }
          }
          claimedRacers = cleanClaims;
          if (callbacks.onRosterUpdated) {
            callbacks.onRosterUpdated(claimedRacers, myPeerId, mode, roomCode, data);
          }
        }
      } else if (data.type === "START_STAGE") {
        const stage = VALID_STAGES.includes(data.stage) ? data.stage : "RECON";
        const diff = VALID_DIFFS.includes(data.difficulty) ? data.difficulty : "MEDIUM";
        const rain = Boolean(data.isRainMode);
        const orderIds = Array.isArray(data.gridOrderIds)
          ? data.gridOrderIds.map((x) => parseInt(x, 10)).filter((x) => VALID_RACER_IDS.includes(x))
          : VALID_RACER_IDS;
        if (callbacks.onRemoteStartStage) {
          callbacks.onRemoteStartStage({ stage, difficulty: diff, isRainMode: rain, gridOrderIds: orderIds });
        }
      } else if (data.type === "WORLD_SNAPSHOT") {
        if (!Array.isArray(data.karts)) return;
        const cleanKarts = data.karts.map(sanitizeKartPacket).filter(Boolean);
        const raceTime = clampNum(data.raceTime, 0, 36000, 0);
        if (callbacks.onWorldSnapshot) {
          callbacks.onWorldSnapshot(cleanKarts, raceTime);
        }
      } else if (data.type === "STAGE_COMPLETE_SYNC") {
        if (callbacks.onRemoteStageComplete) {
          callbacks.onRemoteStageComplete(data);
        }
      }
    }

    function setupBroadcastChannel(code) {
      if (typeof BroadcastChannel === "undefined") return;
      try {
        bcChannel = new BroadcastChannel(ROOM_PREFIX + code);
        bcChannel.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || typeof msg !== "object" || !msg.payload) return;
          if (mode === "HOST" && (msg._target === "HOST" || msg._target === "*")) {
            handleHostIncomingMessage(msg._from, msg.payload);
          } else if (mode === "CLIENT" && (msg._target === myPeerId || msg._target === "*")) {
            handleClientIncomingMessage(msg.payload);
          }
        };
      } catch (e) {}
    }

    function createRoom(initialRacerId) {
      cleanupConnections();
      roomCode = generateRoomCode();
      mode = "HOST";
      myPeerId = "HOST";

      const startRacer = VALID_RACER_IDS.includes(initialRacerId) ? initialRacerId : 1;
      claimedRacers = { [startRacer]: myPeerId };

      setupBroadcastChannel(roomCode);

      if (callbacks.onStatusChange) {
        callbacks.onStatusChange("HOST", roomCode, "Inicializando sala online KART-" + roomCode + "...", false);
      }
      broadcastRosterSync();

      if (typeof window.Peer === "function") {
        try {
          peer = new window.Peer(ROOM_PREFIX + roomCode, { debug: 0 });
          peer.on("open", () => {
            if (callbacks.onStatusChange) {
              callbacks.onStatusChange(
                "HOST",
                roomCode,
                "Sala activa • Comparte el código KART-" + roomCode + " (1/8 pilotos)",
                false
              );
            }
          });
          peer.on("connection", (conn) => {
            const remoteId = String(conn.peer || "peer-" + Math.random().toString(36).slice(2, 8));
            clientConns.set(remoteId, conn);
            conn.on("data", (data) => {
              handleHostIncomingMessage(remoteId, data);
            });
            conn.on("close", () => {
              clientConns.delete(remoteId);
              if (removePeerClaims(remoteId)) {
                broadcastRosterSync();
              }
            });
            conn.on("error", () => {
              clientConns.delete(remoteId);
              if (removePeerClaims(remoteId)) {
                broadcastRosterSync();
              }
            });
          });
          peer.on("error", () => {
            if (callbacks.onStatusChange) {
              callbacks.onStatusChange(
                "HOST",
                roomCode,
                "Sala KART-" + roomCode + " activa en modo Red Local",
                false
              );
            }
          });
        } catch (e) {}
      }
    }

    function joinRoom(rawCode, preferredRacerId) {
      const cleanCode = sanitizeRoomCode(rawCode);
      if (cleanCode.length < 3) {
        if (callbacks.onStatusChange) {
          callbacks.onStatusChange("OFFLINE", "", "Ingresa un código de sala válido (ej. KART-4829).", true);
        }
        return;
      }

      cleanupConnections();
      roomCode = cleanCode;
      mode = "CLIENT";
      myPeerId = "p-" + Math.random().toString(36).slice(2, 9);

      setupBroadcastChannel(roomCode);

      if (callbacks.onStatusChange) {
        callbacks.onStatusChange("CLIENT", roomCode, "Conectando a la sala KART-" + roomCode + "...", false);
      }

      // Enviar solicitud inmediata por canal local (si están en la misma PC/red local)
      sendToHost({
        type: "JOIN_REQ",
        peerId: myPeerId,
        preferredRacerId: VALID_RACER_IDS.includes(preferredRacerId) ? preferredRacerId : 1
      });

      if (typeof window.Peer === "function") {
        try {
          peer = new window.Peer({ debug: 0 });
          peer.on("open", (assignedPeerId) => {
            myPeerId = assignedPeerId || myPeerId;
            const conn = peer.connect(ROOM_PREFIX + roomCode, { reliable: false });
            hostConn = conn;
            conn.on("open", () => {
              conn.send({
                type: "JOIN_REQ",
                peerId: myPeerId,
                preferredRacerId: VALID_RACER_IDS.includes(preferredRacerId) ? preferredRacerId : 1
              });
            });
            conn.on("data", (data) => {
              handleClientIncomingMessage(data);
            });
            conn.on("close", () => {
              if (mode === "CLIENT") {
                cleanupConnections();
                if (callbacks.onStatusChange) {
                  callbacks.onStatusChange("OFFLINE", "", "El anfitrión cerró la sala online.", true);
                }
              }
            });
          });
          peer.on("error", () => {
            // Si no se encuentra por WAN y tampoco respondió por BroadcastChannel tras 4s, informar
            setTimeout(() => {
              if (mode === "CLIENT" && Object.keys(claimedRacers).length === 0) {
                cleanupConnections();
                if (callbacks.onStatusChange) {
                  callbacks.onStatusChange("OFFLINE", "", "No se encontró la sala KART-" + cleanCode + ".", true);
                }
              }
            }, 3500);
          });
        } catch (e) {}
      }
    }

    function leaveRoom() {
      if (mode === "CLIENT") {
        sendToHost({ type: "LEAVE_ROOM", peerId: myPeerId });
      }
      cleanupConnections();
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange("OFFLINE", "", "Modo Individual (Offline contra 7 Bots IA)", false);
      }
      if (callbacks.onRosterUpdated) {
        callbacks.onRosterUpdated({}, "", "OFFLINE", "", null);
      }
    }

    function requestClaimRacer(racerId) {
      if (!VALID_RACER_IDS.includes(racerId)) return false;
      if (mode === "OFFLINE") return true;

      // Verificar que no esté ocupado por otro jugador
      const currentOwner = claimedRacers[racerId];
      if (currentOwner && currentOwner !== myPeerId) {
        return false; // Bloqueado: ya fue elegido por otro usuario
      }

      if (mode === "HOST") {
        removePeerClaims(myPeerId);
        claimedRacers[racerId] = myPeerId;
        broadcastRosterSync();
        return true;
      } else if (mode === "CLIENT") {
        sendToHost({ type: "CLAIM_RACER", peerId: myPeerId, racerId });
        return true;
      }
      return false;
    }

    function syncRaceTick(nowMs, karts, playerKart, raceTime) {
      if (mode === "OFFLINE") return;
      if (nowMs - lastBroadcastTime < 38) return; // ~26 Hz
      lastBroadcastTime = nowMs;

      if (mode === "HOST") {
        const snapshot = karts.map((k) => ({
          racerId: k.racer.id,
          x: Number(k.position.x.toFixed(3)),
          z: Number(k.position.z.toFixed(3)),
          heading: Number(k.heading.toFixed(4)),
          speed: Number(k.speed.toFixed(2)),
          steerAngle: Number(k.steerAngle.toFixed(3)),
          slipAngle: Number((k.slipAngle || 0).toFixed(3)),
          trackT: Number(k.trackT.toFixed(5)),
          lateralOffset: Number(k.lateralOffset.toFixed(3)),
          lap: k.lap,
          passedHalfway: k.passedHalfway,
          finished: k.finished,
          finishTime: Number((k.finishTime || 0).toFixed(3)),
          bestLapTime: k.bestLapTime !== null ? Number(k.bestLapTime.toFixed(3)) : null,
          lastLapTime: k.lastLapTime !== null ? Number(k.lastLapTime.toFixed(3)) : null,
          totalProgress: Number(k.totalProgress.toFixed(5))
        }));
        broadcastFromHost({
          type: "WORLD_SNAPSHOT",
          raceTime: Number(raceTime.toFixed(3)),
          karts: snapshot
        });
      } else if (mode === "CLIENT" && playerKart) {
        sendToHost({
          type: "PLAYER_STATE",
          peerId: myPeerId,
          kart: {
            racerId: playerKart.racer.id,
            x: Number(playerKart.position.x.toFixed(3)),
            z: Number(playerKart.position.z.toFixed(3)),
            heading: Number(playerKart.heading.toFixed(4)),
            speed: Number(playerKart.speed.toFixed(2)),
            steerAngle: Number(playerKart.steerAngle.toFixed(3)),
            slipAngle: Number((playerKart.slipAngle || 0).toFixed(3)),
            trackT: Number(playerKart.trackT.toFixed(5)),
            lateralOffset: Number(playerKart.lateralOffset.toFixed(3)),
            lap: playerKart.lap,
            passedHalfway: playerKart.passedHalfway,
            finished: playerKart.finished,
            finishTime: Number((playerKart.finishTime || 0).toFixed(3)),
            bestLapTime: playerKart.bestLapTime !== null ? Number(playerKart.bestLapTime.toFixed(3)) : null,
            lastLapTime: playerKart.lastLapTime !== null ? Number(playerKart.lastLapTime.toFixed(3)) : null,
            totalProgress: Number(playerKart.totalProgress.toFixed(5))
          }
        });
      }
    }

    function notifyHostStartStage(stage, difficulty, isRainMode, gridOrderIds) {
      if (mode !== "HOST") return;
      broadcastFromHost({
        type: "START_STAGE",
        stage,
        difficulty,
        isRainMode,
        gridOrderIds
      });
    }

    function notifyHostStageComplete(payload) {
      if (mode !== "HOST") return;
      broadcastFromHost(Object.assign({ type: "STAGE_COMPLETE_SYNC" }, payload));
    }

    return {
      getMode: () => mode,
      getRoomCode: () => roomCode,
      getMyPeerId: () => myPeerId,
      getMyRacerId,
      getClaimedRacers: () => Object.assign({}, claimedRacers),
      isRacerClaimedByOther: (rId) => Boolean(claimedRacers[rId] && claimedRacers[rId] !== myPeerId),
      isRacerHumanControlled: (rId) => Boolean(claimedRacers[rId]),
      createRoom,
      joinRoom,
      leaveRoom,
      requestClaimRacer,
      broadcastRosterSync,
      syncRaceTick,
      notifyHostStartStage,
      notifyHostStageComplete
    };
  };
})();
