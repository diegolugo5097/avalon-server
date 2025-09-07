import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./styles.css";

const socket = io("https://TU_SERVIDOR_DE_SOCKETS"); // Reemplaza

function App() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("default");
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState("lobby");
  const [roles, setRoles] = useState({});
  const [leaderId, setLeaderId] = useState(null);
  const [team, setTeam] = useState([]);
  const [teamVotes, setTeamVotes] = useState([]);
  const [missionVotes, setMissionVotes] = useState([]);
  const [results, setResults] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [showRole, setShowRole] = useState(false);

  useEffect(() => {
    socket.on("updatePlayers", setPlayers);
    socket.on("gameStarted", ({ phase, leaderId, roles }) => {
      setPhase(phase);
      setLeaderId(leaderId);
      setRoles(roles);
    });
    socket.on("teamSelected", ({ phase, team }) => {
      setPhase(phase);
      setTeam(team);
    });
    socket.on("teamVoteResult", ({ phase, leaderId }) => {
      setPhase(phase);
      setLeaderId(leaderId);
    });
    socket.on("updateTeamVotes", setTeamVotes);
    socket.on("updateMissionVotes", setMissionVotes);
    socket.on("missionResult", ({ results, gameOver }) => {
      setResults(results);
      setGameOver(gameOver);
    });
    socket.on("nextRound", ({ phase, leaderId }) => {
      setPhase(phase);
      setLeaderId(leaderId);
      setTeam([]);
      setTeamVotes([]);
      setMissionVotes([]);
    });
  }, []);

  const joinRoom = () => {
    if (name) socket.emit("joinRoom", { name, room });
  };
  const startGame = () => socket.emit("startGame", { room });
  const selectTeam = (playerId) =>
    setTeam((prev) =>
      prev.includes(playerId)
        ? prev.filter((p) => p !== playerId)
        : [...prev, playerId]
    );
  const confirmTeam = () => socket.emit("selectTeam", { room, team });
  const voteTeam = (vote) =>
    socket.emit("voteTeam", { room, playerId: socket.id, vote });
  const voteMission = (vote) =>
    socket.emit("voteMission", { room, playerId: socket.id, vote });

  if (gameOver)
    return (
      <div className="container">
        <h2>🏆 Juego terminado</h2>
        <p
          className={
            results.filter((r) => r.success).length >= 3 ? "success" : "danger"
          }
        >
          {results.filter((r) => r.success).length >= 3
            ? "✅ Los Buenos ganan!"
            : "❌ Los Malos ganan!"}
        </p>
        <ul>
          {results.map((r) => (
            <li key={r.round}>
              Ronda {r.round}: {r.success ? "✅ Éxito" : "❌ Fracaso"}
            </li>
          ))}
        </ul>
        <button className="primary" onClick={() => window.location.reload()}>
          Reiniciar
        </button>
      </div>
    );

  return (
    <div className="container">
      {phase === "lobby" && (
        <>
          <h2>Lobby</h2>
          <input
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="primary" onClick={joinRoom}>
            Unirse
          </button>
          <button className="success" onClick={startGame}>
            Iniciar partida
          </button>
          <h3>Jugadores:</h3>
          <ul>
            {players.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </>
      )}
      {phase !== "lobby" && (
        <>
          <h3>Líder: {leaderId}</h3>
          <button className="primary" onClick={() => setShowRole(!showRole)}>
            👁️ Ver rol
          </button>
          {showRole && <p>Tu rol: {roles[socket.id]}</p>}
          {phase === "teamSelection" && (
            <div>
              <h3>Selecciona equipo</h3>
              <ul>
                {players.map((p) => (
                  <li key={p.id}>
                    {p.name}{" "}
                    <button
                      className="primary"
                      onClick={() => selectTeam(p.id)}
                    >
                      {team.includes(p.id) ? "❌" : "✅"}
                    </button>
                  </li>
                ))}
              </ul>
              <button className="success" onClick={confirmTeam}>
                Confirmar equipo
              </button>
            </div>
          )}
          {phase === "teamVote" && (
            <div>
              <h3>Vota el equipo propuesto</h3>
              <button className="success" onClick={() => voteTeam("Sí")}>
                👍 Sí
              </button>
              <button className="danger" onClick={() => voteTeam("No")}>
                👎 No
              </button>
              <p>
                Votos: {teamVotes.length}/{players.length}
              </p>
            </div>
          )}
          {phase === "missionVote" && team.includes(socket.id) && (
            <div>
              <h3>Vota la misión</h3>
              <button className="success" onClick={() => voteMission("Éxito")}>
                ✅ Éxito
              </button>
              <button className="danger" onClick={() => voteMission("Fracaso")}>
                ❌ Fracaso
              </button>
              <p>
                Votos de misión: {missionVotes.length}/{team.length}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
