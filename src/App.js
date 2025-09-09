import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import "./styles.css";

const socket = io("https://avalon-serve.onrender.com", {
  transports: ["websocket"],
});

export default function App() {
  // Código de sala
  const [roomCode, setRoomCode] = useState("");

  // Lobby
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [assassinCount, setAssassinCount] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isCreator, setIsCreator] = useState(false);

  // UI
  const [showGameOver, setShowGameOver] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const avatarList = Array.from(
    { length: 11 },
    (_, i) => `/avatars/avatar${i + 1}.JPG`
  );

  // Estado del servidor
  const [state, setState] = useState({
    phase: "lobby",
    leaderId: null,
    round: 1,
    results: [],
    goodWins: 0,
    assassinWins: 0,
    team: [],
    teamVotes: [],
    missionVotes: [],
    players: [],
    maxPlayers: 4,
    roles: undefined, // el server lo envía solo en gameOver
  });

  // Rol y modal de misión
  const [myRole, setMyRole] = useState(null);
  const [showMissionResult, setShowMissionResult] = useState(false);
  const [lastMissionResult, setLastMissionResult] = useState(null); // "success" | "fail"
  const [missionCounts, setMissionCounts] = useState({ success: 0, fail: 0 });

  /* ======================
     Persistencia en localStorage
     ====================== */
  useEffect(() => {
    setName(localStorage.getItem("avalon_name") || "");
    setAvatar(localStorage.getItem("avalon_avatar") || "");
    setRoomCode(localStorage.getItem("avalon_roomCode") || "");
    setIsCreator(localStorage.getItem("avalon_isCreator") === "1");
    const ac = localStorage.getItem("avalon_assassinCount");
    const mp = localStorage.getItem("avalon_maxPlayers");
    if (ac) setAssassinCount(Number(ac));
    if (mp) setMaxPlayers(Number(mp));
  }, []);

  useEffect(() => localStorage.setItem("avalon_name", name), [name]);
  useEffect(() => localStorage.setItem("avalon_avatar", avatar), [avatar]);
  useEffect(
    () => localStorage.setItem("avalon_roomCode", roomCode),
    [roomCode]
  );
  useEffect(
    () => localStorage.setItem("avalon_assassinCount", String(assassinCount)),
    [assassinCount]
  );
  useEffect(
    () => localStorage.setItem("avalon_maxPlayers", String(maxPlayers)),
    [maxPlayers]
  );
  useEffect(() => {
    localStorage.setItem("avalon_isCreator", isCreator ? "1" : "0");
  }, [isCreator]);

  // Restaurar rol guardado por sala cuando cambia roomCode
  useEffect(() => {
    if (!roomCode) {
      const legacy = localStorage.getItem("avalon_role");
      if (legacy) setMyRole(legacy);
      return;
    }
    const saved = localStorage.getItem(`avalon_role_${roomCode}`);
    if (saved) setMyRole(saved);
  }, [roomCode]);

  // Guardar rol por sala cuando cambie
  useEffect(() => {
    const key = roomCode ? `avalon_role_${roomCode}` : "avalon_role";
    if (myRole) {
      localStorage.setItem(key, myRole);
    } else {
      localStorage.removeItem(key);
    }
  }, [myRole, roomCode]);

  /* ======================
     Reconexión y auto-join
     ====================== */
  useEffect(() => {
    const onConnect = () => {
      const lastSid = localStorage.getItem("avalon_sid");
      if (lastSid) localStorage.setItem("avalon_prevSid", lastSid);
      localStorage.setItem("avalon_sid", socket.id);

      // Auto-rejoin si hay datos guardados y estamos en lobby
      const savedName = localStorage.getItem("avalon_name");
      const savedCode = localStorage.getItem("avalon_roomCode");
      const savedAvatar = localStorage.getItem("avalon_avatar");
      const prevId = localStorage.getItem("avalon_prevSid");
      if (savedName && savedCode && state.phase === "lobby") {
        socket.emit("joinRoom", {
          name: savedName,
          roomCode: savedCode.toUpperCase(),
          avatar: savedAvatar || "",
          prevId,
        });
      }
    };
    socket.on("connect", onConnect);
    return () => socket.off("connect", onConnect);
  }, [state.phase]);

  /* ======================
     Listeners de UI / juego
     ====================== */
  useEffect(() => {
    const onTeamVoteStart = () => {
      const sound = new Audio("/sounds/notify.mp3");
      sound.volume = 0.7;
      sound.play().catch(() => {});
    };
    socket.on("teamVoteStart", onTeamVoteStart);
    return () => socket.off("teamVoteStart", onTeamVoteStart);
  }, []);

  useEffect(() => {
    const onState = (s) => setState(s);
    const onRole = (role) => setMyRole(role);
    const onToast = ({ msg }) => alert(msg);

    const onRoomCreated = ({ roomCode: rc }) => {
      // Limpiar rol anterior (si existía en otra sala)
      if (roomCode) localStorage.removeItem(`avalon_role_${roomCode}`);
      setRoomCode(rc);
      setMyRole(null); // se asignará cuando inicie la partida
      setIsCreator(true);
      localStorage.setItem("avalon_isCreator", "1");
      alert(`Sala creada. Código: ${rc}`);
    };

    const onMissionResult = ({ winner, successVotes, failVotes }) => {
      setLastMissionResult(winner === "Buenos" ? "success" : "fail");
      setMissionCounts({
        success: Number(successVotes) || 0,
        fail: Number(failVotes) || 0,
      });

      const sound = new Audio(
        winner === "Buenos" ? "/sounds/success.mp3" : "/sounds/fail.mp3"
      );
      sound.volume = 0.7;
      sound.play().catch(() => {});
      setShowMissionResult(true);
      setTimeout(() => setShowMissionResult(false), 2500);
    };

    socket.on("state", onState);
    socket.on("yourRole", onRole);
    socket.on("toast", onToast);
    socket.on("roomCreated", onRoomCreated);
    socket.on("missionResult", onMissionResult);

    return () => {
      socket.off("state", onState);
      socket.off("yourRole", onRole);
      socket.off("toast", onToast);
      socket.off("roomCreated", onRoomCreated);
      socket.off("missionResult", onMissionResult);
    };
  }, [roomCode]);

  useEffect(() => {
    if (state.phase === "gameOver") setShowGameOver(true);
  }, [state.phase]);

  /* ======================
     Acciones
     ====================== */
  const create = () => {
    if (!name) return alert("Escribe un nombre");
    if (maxPlayers < 4 || maxPlayers > 10)
      return alert("Máx. jugadores debe estar entre 4 y 10");
    if (assassinCount < 1 || assassinCount >= maxPlayers)
      return alert(
        "Asesinos debe ser al menos 1 y menor que el total de jugadores"
      );

    socket.emit("createRoom", {
      name,
      avatar,
      maxPlayers: Number(maxPlayers),
      assassinCount: Number(assassinCount),
    });
    // el server responde con roomCreated → allí marcamos isCreator
  };

  const join = () => {
    if (!name) return alert("Escribe un nombre");
    if (!roomCode) return alert("Ingresa el código de la sala");
    const prevId = localStorage.getItem("avalon_prevSid");
    const code = (roomCode || "").toUpperCase();

    // precarga rol guardado de esa sala (si existe) para evitar "?"
    setMyRole(localStorage.getItem(`avalon_role_${code}`) || null);

    setIsCreator(false);
    localStorage.setItem("avalon_isCreator", "0");

    socket.emit("joinRoom", {
      name,
      roomCode: code,
      avatar,
      prevId,
    });
  };

  const start = () =>
    socket.emit("startGame", {
      roomCode: roomCode || undefined,
      assassinCount: Number(assassinCount || 1),
      maxPlayers,
    });

  const toggleTeam = (id) => {
    if (state.phase !== "teamSelection") return;
    if (state.leaderId !== socket.id) return;
    const next = state.team.includes(id)
      ? state.team.filter((x) => x !== id)
      : [...state.team, id];
    socket.emit("draftTeam", { roomCode, team: next });
  };

  const confirmTeam = () => {
    socket.emit("selectTeam", { roomCode, team: state.team });
  };

  const voteTeam = (vote) => socket.emit("voteTeam", { roomCode, vote });
  const voteMission = (vote) => socket.emit("voteMission", { roomCode, vote });

  const iAmLeader = state.leaderId === socket.id;
  const gameOver =
    state.assassinWins >= 3 || state.goodWins >= 3 || state.round > 5;

  // Tamaño requerido según reglas
  const missionTeamSizes = {
    4: [2, 2, 2, 3, 3],
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5],
  };
  const requiredTeamSize =
    missionTeamSizes[state.maxPlayers || state.players.length]?.[
      state.round - 1
    ] || 2;

  // Posicionar jugadores en círculo
  const circlePlayers = useMemo(() => {
    const arr = state.players || [];
    const n = Math.max(arr.length, 1);
    return arr.map((p, i) => {
      const angle = (360 / n) * i;
      return { ...p, angle };
    });
  }, [state.players]);

  /* ======================
     UI
     ====================== */
  return (
    <div className="container">
      {/* Modal resultado misión con conteo */}
      {showMissionResult && (
        <div className="modal-backdrop">
          <div
            className={`modal ${
              lastMissionResult === "success" ? "success" : "fail"
            }`}
          >
            <div className="icon">
              <img
                width={200}
                height={200}
                src={
                  lastMissionResult === "success"
                    ? "/avatars/agentsWin.PNG"
                    : "/avatars/assasinsWin.PNG"
                }
                alt=""
              />
            </div>

            <div
              className="row"
              style={{ justifyContent: "center", marginTop: 6 }}
            >
              <span className="badge">Éxitos: {missionCounts.success}</span>
              <span className="badge">Fracasos: {missionCounts.fail}</span>
            </div>
          </div>
        </div>
      )}

      {/* Lobby */}
      {state.phase === "lobby" && (
        <div className="panel">
          <h2>Ávalon — Lobby</h2>

          {/* Campos comunes */}
          <div className="row">
            <input
              className="input"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="row">
              <div className="avatar-selector">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="selected-avatar" />
                ) : (
                  <span className="selected-avatar"></span>
                )}
                <button
                  className="btn ghost"
                  onClick={() => setShowAvatarModal(true)}
                >
                  Elegir Avatar
                </button>
              </div>
            </div>
          </div>

          {/* Crear sala */}
          <h3>Crear una sala</h3>
          <div className="row">
            <label className="badge">Cant. Jugadores:</label>
            <input
              className="input"
              type="number"
              min="4"
              max="10"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              placeholder="Máx. jugadores"
            />
            <label className="badge">Cant. Asesinos:</label>
            <input
              className="input"
              type="number"
              min="1"
              max={Math.max(1, maxPlayers - 1)}
              value={assassinCount}
              onChange={(e) => setAssassinCount(Number(e.target.value))}
              placeholder="Asesinos"
            />
            <button className="btn good" onClick={create}>
              Crear sala
            </button>
          </div>

          {roomCode && (
            <div className="row">
              <span className="badge">Código de sala: {roomCode}</span>
            </div>
          )}

          {/* Unirse a sala */}
          {!isCreator && (
            <>
              <h3>Unirse a una sala</h3>
              <div className="row">
                <input
                  className="input"
                  placeholder="Código de sala (ej. ABC123)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
                <button className="btn primary" onClick={join}>
                  Unirme
                </button>
              </div>
            </>
          )}

          {/* Lista de jugadores y control de inicio */}
          {state.players?.length > 0 && (
            <>
              <h3>
                Jugadores ({state.players.length}/{state.maxPlayers})
              </h3>
              <div className="row">
                {state.players.map((p) => (
                  <span key={p.id} className="badge">
                    {p.name}
                  </span>
                ))}
              </div>

              <div style={{ height: 8 }} />
              <div className="row">
                {isCreator ? (
                  <>
                    <button className="btn good" onClick={start}>
                      Iniciar partida
                    </button>
                  </>
                ) : (
                  <span className="badge">
                    Esperando a que el creador inicie…
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mesa */}
      {state.phase !== "lobby" && (
        <>
          <div className="tableWrap panel">
            <div className="tableDisk" />

            {/* Jugadores */}
            {circlePlayers.map((p) => {
              const isSelected = state.team.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`player ${
                    p.id === state.leaderId ? "leader" : ""
                  }`}
                  style={{
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) rotate(${
                      p.angle
                    }deg) translateY(calc(-1 * var(--radius))) rotate(${-p.angle}deg)`,
                  }}
                >
                  <div className={`playerCard ${isSelected ? "selected" : ""}`}>
                    <div className="avatar">
                      {p.avatar && p.avatar.startsWith("/avatars/") ? (
                        <img
                          src={p.avatar}
                          alt="avatar"
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        (p.name || "?").slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      {p.id === state.leaderId && (
                        <span className="crown">👑</span>
                      )}
                      <span
                        style={{
                          color: "#e3e6ff",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                    {iAmLeader && state.phase === "teamSelection" && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          className={`btn ${isSelected ? "evil" : "ghost"}`}
                          onClick={() => toggleTeam(p.id)}
                        >
                          {isSelected ? "Quitar" : "Añadir"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* HUD central */}
            <div className="centerHUD">
              <div className="kpi">
                <span className="badge">
                  Ronda {Math.min(state.round, 5)} / 5
                </span>
                <span className="badge">
                  Jugadores requeridos: {requiredTeamSize}
                </span>
                <span className="badge">Buenos: {state.goodWins}</span>
                <span className="badge">Asesinos: {state.assassinWins}</span>
              </div>

              <div className="chips">
                {[...Array(5)].map((_, i) => {
                  const res = state.results.find((r) => r.round === i + 1);
                  return (
                    <div
                      key={i}
                      className={`chip ${
                        res ? (res.winner === "Buenos" ? "good" : "evil") : ""
                      }`}
                    >
                      {res ? (res.winner === "Buenos" ? "✓" : "✗") : i + 1}
                    </div>
                  );
                })}
              </div>

              {state.phase === "teamSelection" && (
                <div className="actions">
                  {iAmLeader ? (
                    <>
                      <span className="badge">
                        Debes elegir exactamente {requiredTeamSize} jugadores
                        para esta misión
                      </span>
                      <button
                        className="btn primary"
                        disabled={state.team.length !== requiredTeamSize}
                        onClick={confirmTeam}
                      >
                        Confirmar equipo ({state.team.length}/{requiredTeamSize}
                        )
                      </button>
                    </>
                  ) : (
                    <span className="badge">Esperando al líder…</span>
                  )}
                </div>
              )}

              {state.phase === "teamVote" && (
                <div className="actions">
                  <span className="badge">¿Apruebas este equipo?</span>
                  <button
                    className="btn good"
                    onClick={() => voteTeam("Aprobar")}
                  >
                    👍 Aprobar
                  </button>
                  <button
                    className="btn evil"
                    onClick={() => voteTeam("Rechazar")}
                  >
                    👎 Rechazar
                  </button>
                  <span className="badge">
                    Votos: {state.teamVotes.length}/{state.players.length}
                  </span>
                </div>
              )}

              {state.phase === "missionVote" &&
                state.team.includes(socket.id) && (
                  <div className="actions">
                    <span className="badge">Tu voto para la misión</span>
                    <button
                      className="btn good"
                      onClick={() => voteMission("Éxito")}
                    >
                      ✅ Éxito
                    </button>
                    <button
                      className="btn evil"
                      onClick={() => voteMission("Fracaso")}
                    >
                      ❌ Fracaso
                    </button>
                    <span className="badge">
                      Votos misión: {state.missionVotes.length}/
                      {state.team.length}
                    </span>
                  </div>
                )}

              {state.phase === "missionVote" &&
                !state.team.includes(socket.id) && (
                  <div className="actions">
                    <span className="badge">
                      No formas parte de esta misión…
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Barra inferior */}
          <div
            className="panel row"
            style={{ justifyContent: "space-between" }}
          >
            <div className="row">
              <span className="badge">Código: {roomCode || "—"}</span>
              <span className="badge">
                Líder:{" "}
                {state.players.find((p) => p.id === state.leaderId)?.name ||
                  "?"}
              </span>
            </div>
            <div className="row">
              <button
                className="btn ghost"
                onClick={() => alert(`Tu rol es: ${myRole || "?"}`)}
              >
                👁️ Ver mi rol
              </button>
              {gameOver && (
                <button
                  className="btn primary"
                  onClick={() => {
                    // Limpia rol guardado de esta sala al reiniciar (opcional)
                    if (roomCode)
                      localStorage.removeItem(`avalon_role_${roomCode}`);
                    window.location.reload();
                  }}
                >
                  Reiniciar
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tabla de jugadores por misión */}
      <div className="mission-table">
        <h4>Jugadores por misión</h4>
        <table>
          <thead>
            <tr>
              <th>Jugadores</th>
              <th>Misión 1</th>
              <th>Misión 2</th>
              <th>Misión 3</th>
              <th>Misión 4</th>
              <th>Misión 5</th>
            </tr>
          </thead>
          <tbody>
            {[4, 5, 6, 7, 8, 9, 10].map((count) => {
              const row = {
                4: [2, 2, 2, 3, 3],
                5: [2, 3, 2, 3, 3],
                6: [2, 3, 4, 3, 4],
                7: [2, 3, 3, 4, 4],
                8: [3, 4, 4, 5, 5],
                9: [3, 4, 4, 5, 5],
                10: [3, 4, 4, 5, 5],
              }[count];
              return (
                <tr
                  key={count}
                  className={
                    state.players.length === count ? "highlight-row" : ""
                  }
                >
                  <td>{count}</td>
                  {row.map((val, idx) => (
                    <td
                      key={idx}
                      className={
                        state.players.length === count &&
                        state.round === idx + 1
                          ? "current-mission"
                          : ""
                      }
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de fin de partida */}
      {showGameOver && (
        <div className="modal-backdrop">
          <div className="modal game-over">
            <h2>🏆 ¡Partida Finalizada!</h2>
            <h3>
              Ganador:{" "}
              <span
                style={{ color: state.goodWins >= 3 ? "#4caf50" : "#f44336" }}
              >
                {state.goodWins >= 3 ? "Buenos ⚔️" : "Asesinos 🥷"}
              </span>
            </h3>

            <div className="roles-list">
              <h4>Asesinos 🥷</h4>
              <ul>
                {state.roles
                  ? Object.entries(state.roles)
                      .filter(([, role]) => role === "Asesino")
                      .map(([id]) => {
                        const p = state.players.find((x) => x.id === id);
                        return (
                          <li key={id} style={{ color: "red" }}>
                            {p?.name || id}
                          </li>
                        );
                      })
                  : null}
              </ul>
            </div>

            <button
              className="btn primary"
              onClick={() => {
                if (roomCode)
                  localStorage.removeItem(`avalon_role_${roomCode}`);
                window.location.reload();
              }}
            >
              🔄 Reiniciar Partida
            </button>
          </div>
        </div>
      )}

      {/* Modal de avatares */}
      {showAvatarModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAvatarModal(false)}
        >
          <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Elige tu Avatar</h3>
            <div className="avatar-grid">
              {avatarList.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`avatar-${idx}`}
                  className={`avatar-option ${
                    avatar === img ? "selected" : ""
                  }`}
                  onClick={() => {
                    setAvatar(img);
                    setShowAvatarModal(false);
                  }}
                />
              ))}
            </div>
            <button
              className="btn primary"
              onClick={() => setShowAvatarModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
