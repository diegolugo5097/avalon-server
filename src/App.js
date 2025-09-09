import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import "./styles.css";

const socket = io("https://avalon-serve.onrender.com", {
  transports: ["websocket"],
});

export default function App() {
  // Lobby
  const [room, setRoom] = useState("sala-1");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [assassinCount, setAssassinCount] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4); // NUEVO: máximo de jugadores
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
    maxPlayers: 5,
  });

  const [myRole, setMyRole] = useState(null);
  const [showMissionResult, setShowMissionResult] = useState(false);
  const [lastMissionResult, setLastMissionResult] = useState(null);
  const [prevResultsLength, setPrevResultsLength] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sonido inicio votación
  useEffect(() => {
    socket.on("teamVoteStart", () => {
      const sound = new Audio("/sounds/notify.mp3");
      sound.volume = 0.7;
      sound.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    socket.on("connect", () => {});
    socket.on("state", (s) => setState(s));
    socket.on("yourRole", (role) => setMyRole(role));
    socket.on("toast", ({ msg }) => alert(msg));

    return () => {
      socket.off("state");
      socket.off("yourRole");
      socket.off("toast");
    };
  }, []);

  useEffect(() => {
    if (state.phase === "gameOver") {
      setShowGameOver(true);
    }
  }, [state.phase]);

  // Modal resultado misión
  useEffect(() => {
    if (state.results.length > prevResultsLength) {
      const last = state.results[state.results.length - 1];
      if (last) {
        setLastMissionResult(last.winner === "Buenos" ? "success" : "fail");
        setShowMissionResult(true);

        const sound = new Audio(
          last.winner === "Buenos" ? "/sounds/success.mp3" : "/sounds/fail.mp3"
        );
        sound.volume = 0.7;
        sound.play().catch(() => {});

        setTimeout(() => {
          setShowMissionResult(false);
        }, 2500);
      }
      setPrevResultsLength(state.results.length);
    }
  }, [state.results, prevResultsLength]);

  // Unirse al lobby
  const join = () => {
    if (!name) return alert("Escribe un nombre");
    // Notar: ya no enviamos ni usamos assassinList aquí
    socket.emit("joinRoom", { name, room, avatar });
  };

  // Iniciar juego
  const start = () =>
    socket.emit("startGame", {
      room,
      assassinCount: Number(assassinCount || 1),
      maxPlayers,
    });

  // Selección de equipo
  const toggleTeam = (id) => {
    if (state.phase !== "teamSelection") return;
    if (state.leaderId !== socket.id) return;
    const next = state.team.includes(id)
      ? state.team.filter((x) => x !== id)
      : [...state.team, id];
    socket.emit("draftTeam", { room, team: next });
  };

  const confirmTeam = () => {
    socket.emit("selectTeam", { room, team: state.team });
  };

  // Votar equipo
  const voteTeam = (vote) => socket.emit("voteTeam", { room, vote });

  // Votar misión
  const voteMission = (vote) => socket.emit("voteMission", { room, vote });

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

  return (
    <div className="container">
      {/* Modal resultado misión */}
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
                src={`${
                  lastMissionResult === "success"
                    ? "/avatars/agentsWin.PNG"
                    : "/avatars/assasinsWin.PNG"
                }`}
                alt=""
              />
            </div>
            <h2>
              {lastMissionResult === "success"
                ? "¡Misión Exitosa!"
                : "¡Misión Fallida!"}
            </h2>
          </div>
        </div>
      )}

      {/* Lobby */}
      {state.phase === "lobby" && (
        <div className="panel">
          <h2>Ávalon — Lobby</h2>
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
            <input
              className="input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Sala"
            />
            <input
              className="input"
              type="number"
              min="5"
              max="10"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              placeholder="Máx. jugadores"
            />
            <button className="btn primary" onClick={join}>
              Unirme
            </button>
          </div>

          <div style={{ height: 8 }} />
          <div className="row">
            <label className="badge">Asesinos:</label>
            <input
              className="input"
              type="number"
              min={1}
              max={Math.max(1, (state.players?.length || 2) - 1)}
              value={assassinCount}
              onChange={(e) => setAssassinCount(e.target.value)}
            />
            <button className="btn good" onClick={start}>
              Iniciar partida
            </button>
          </div>

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

              {/* Fase de selección de equipo */}
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

              {/* Fase de votación de equipo */}
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

              {/* Fase de votación de misión */}
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
              <span className="badge">Sala: {room}</span>
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
                  onClick={() => window.location.reload()}
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
                {(state.roles
                  ? state.players.filter((p) => state.roles[p.id] === "Asesino")
                  : []
                ).map((p) => (
                  <li key={p.id} style={{ color: "red" }}>
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>

            <button
              className="btn primary"
              onClick={() => window.location.reload()}
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
