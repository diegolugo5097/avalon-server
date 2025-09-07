import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import "./styles.css";

// ⚠️ Cambia por tu URL de Render:
const socket = io("https://avalon-serve.onrender.com", {
  transports: ["websocket"],
});

export default function App() {
  // Lobby
  const [room, setRoom] = useState("sala-1");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [assassinCount, setAssassinCount] = useState(2);

  // 📌 Calcular jugadores requeridos para la misión
  const missionTeamSizes = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5],
  };
  const requiredTeamSize =
    missionTeamSizes[state.players.length]?.[state.round - 1] || 2;

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
  });

  // Rol privado
  const [myRole, setMyRole] = useState(null);
  const myId = socket.id;

  useEffect(() => {
    socket.on("connect", () => {
      // noop
    });
    socket.on("state", (s) => setState(s));
    socket.on("yourRole", (role) => setMyRole(role));
    socket.on("toast", ({ type, msg }) => alert(msg));
    socket.on("roundResolved", (r) => {
      // podrías mostrar una modal si quieres
      console.log("Ronda resuelta:", r);
    });
    return () => {
      socket.off("state");
      socket.off("yourRole");
      socket.off("toast");
      socket.off("roundResolved");
    };
  }, []);

  // Unirse al lobby
  const join = () => {
    if (!name) return alert("Escribe un nombre");
    socket.emit("joinRoom", { name, room, avatar });
  };

  // Iniciar juego
  const start = () =>
    socket.emit("startGame", {
      room,
      assassinCount: Number(assassinCount || 1),
    });

  // Selección de equipo
  const toggleTeam = (id) => {
    if (state.phase !== "teamSelection") return;
    const next = state.team.includes(id)
      ? state.team.filter((x) => x !== id)
      : [...state.team, id];
    socket.emit("selectTeam", { room, team: next });
  };

  // Votos
  const voteTeam = (vote) => socket.emit("voteTeam", { room, vote }); // "Sí" | "No"
  const voteMission = (vote) => socket.emit("voteMission", { room, vote }); // "Éxito" | "Fracaso"

  const iAmLeader = state.leaderId === socket.id;
  const gameOver =
    state.assassinWins >= 3 || state.goodWins >= 3 || state.round > 5;

  // Orden circular de jugadores
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
      {/* LOBBY */}
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
            <input
              className="input"
              placeholder="Avatar (emoji opcional)"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
            <input
              className="input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Sala"
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

          <h3>Jugadores ({state.players.length})</h3>
          <div className="row">
            {state.players.map((p) => (
              <span key={p.id} className="badge">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MESA */}
      {state.phase !== "lobby" && (
        <>
          <div className="tableWrap panel">
            <div className="tableDisk" />

            {/* Jugadores alrededor */}
            {circlePlayers.map((p, idx) => (
              <div
                key={p.id}
                className={`player ${p.id === state.leaderId ? "leader" : ""}`}
                style={{
                  left: 305,
                  top: 305,
                  transform: `rotate(${
                    p.angle
                  }deg) translateY(-340px) rotate(${-p.angle}deg)`,
                }}
              >
                <div className="playerCard">
                  <div className="avatar">
                    {p.avatar
                      ? p.avatar
                      : (p.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                      alignItems: "center",
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

                  {/* Botón para añadir/remover del equipo si soy líder y estamos en selección */}
                  {iAmLeader && state.phase === "teamSelection" && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        className={`btn ${
                          state.team.includes(p.id) ? "evil" : "ghost"
                        }`}
                        onClick={() => toggleTeam(p.id)}
                      >
                        {state.team.includes(p.id) ? "Quitar" : "Añadir"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* HUD central */}
            <div className="centerHUD">
              <div className="kpi">
                <span className="badge">
                  Ronda {Math.min(state.round, 5)} / 5
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

              {/* Acciones por fase */}
              {state.phase === "teamSelection" && (
                <div className="actions">
                  {iAmLeader ? (
                    <>
                      <span className="badge">
                        Debes elegir exactamente {requiredTeamSize} jugadores
                      </span>
                      <button
                        className="btn primary"
                        disabled={state.team.length !== requiredTeamSize}
                        onClick={() =>
                          socket.emit("selectTeam", { room, team: state.team })
                        }
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
                  <button className="btn good" onClick={() => voteTeam("Sí")}>
                    👍 Aprobado
                  </button>
                  <button className="btn evil" onClick={() => voteTeam("No")}>
                    👎 Rechazado
                  </button>
                  <span className="badge">
                    Votos: {state.teamVotes.length}/{state.players.length}
                  </span>
                  <span className="badge">
                    Regla: 1 rechazo ⇒ gana Asesinos la ronda
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
    </div>
  );
}
