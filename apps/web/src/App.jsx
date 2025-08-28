import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [universes, setUniverses] = useState([]);
  const [selectedUniverse, setSelectedUniverse] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('match_result', (result) => {
      setMatchResult(result);
    });

    newSocket.on('lobby_update', (universe) => {
      setSelectedUniverse(universe);
    });

    // Fetch universes
    fetch('http://localhost:3001/api/universes')
      .then(res => res.json())
      .then(data => setUniverses(data));

    return () => newSocket.close();
  }, []);

  const simulateMatch = () => {
    if (socket) {
      socket.emit('simulate_match', {
        fixtureId: 'fixture-1',
        universeSeed: '0x1F4A9B8C7D6E5F00',
        fixtureSeed: '0x3E2D1C0B9A8F7E6D'
      });
    }
  };

  const joinLobby = (universeId) => {
    if (socket) {
      socket.emit('join_lobby', {
        userId: 'user-1',
        universeId
      });
    }
  };

  return (
    <div className="container">
      <h1>ProLeague</h1>

      <div>
        <h2>Universes</h2>
        <ul>
          {universes.map(universe => (
            <li key={universe.id}>
              {universe.name} ({universe.season})
              <button onClick={() => joinLobby(universe.id)}>Join Lobby</button>
            </li>
          ))}
        </ul>
      </div>

      {selectedUniverse && (
        <div>
          <h2>Lobby: {selectedUniverse.name}</h2>
          <p>Season: {selectedUniverse.season}</p>
          <p>Matches: {selectedUniverse.matches.length}</p>
        </div>
      )}

      <button onClick={simulateMatch}>Simulate Match</button>

      {matchResult && (
        <div className="match-result">
          <h2>Match Result</h2>
          <p>Home Score: {matchResult.homeScore}</p>
          <p>Away Score: {matchResult.awayScore}</p>
          <h3>Events</h3>
          <ul className="event-list">
            {matchResult.events.map((event, index) => (
              <li key={index} className="event-item">
                {event.minute}' - {event.team} {event.eventType} by {event.player}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
