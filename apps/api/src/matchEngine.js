import { pcg32 } from './pcg32.js';

export const matchEngine = {
  simulateMatch: (fixtureId, universeSeed, fixtureSeed) => {
    const rng = pcg32(fixtureSeed);

    const eventLog = [];
    const matchReport = {
      fixtureId,
      homeScore: 0,
      awayScore: 0,
      events: [],
      possession: {
        home: 0,
        away: 0
      },
      shots: {
        home: 0,
        away: 0
      },
      corners: {
        home: 0,
        away: 0
      },
      fouls: {
        home: 0,
        away: 0
      },
      yellowCards: {
        home: 0,
        away: 0
      },
      redCards: {
        home: 0,
        away: 0
      }
    };

    // Team attributes
    const homeTeam = {
      name: 'Home Team',
      attack: 85,
      midfield: 82,
      defense: 80,
      overall: 83
    };

    const awayTeam = {
      name: 'Away Team',
      attack: 84,
      midfield: 83,
      defense: 81,
      overall: 83
    };

    // Minute-based simulation
    for (let minute = 0; minute <= 90; minute++) {
      // Generate micro-events for this minute
      const microEvents = generateMicroEvents(rng, minute, homeTeam, awayTeam);
      eventLog.push(...microEvents);

      // Update match report
      microEvents.forEach(event => {
        if (event.eventType === 'goal') {
          if (event.teamId === 'club-1') {
            matchReport.homeScore++;
          } else {
            matchReport.awayScore++;
          }
        }

        // Update statistics
        if (event.teamId === 'club-1') {
          if (event.eventType === 'possession') matchReport.possession.home++;
          if (event.eventType === 'shot') matchReport.shots.home++;
          if (event.eventType === 'corner') matchReport.corners.home++;
          if (event.eventType === 'foul') matchReport.fouls.home++;
          if (event.eventType === 'yellowCard') matchReport.yellowCards.home++;
          if (event.eventType === 'redCard') matchReport.redCards.home++;
        } else {
          if (event.eventType === 'possession') matchReport.possession.away++;
          if (event.eventType === 'shot') matchReport.shots.away++;
          if (event.eventType === 'corner') matchReport.corners.away++;
          if (event.eventType === 'foul') matchReport.fouls.away++;
          if (event.eventType === 'yellowCard') matchReport.yellowCards.away++;
          if (event.eventType === 'redCard') matchReport.redCards.away++;
        }

        matchReport.events.push({
          minute,
          team: event.teamId === 'club-1' ? 'Home' : 'Away',
          eventType: event.eventType,
          player: `Player ${event.playerId.split('-')[1]}`,
          x: event.x,
          y: event.y
        });
      });
    }

    // Calculate final possession percentages
    const totalPossession = matchReport.possession.home + matchReport.possession.away;
    matchReport.possession.home = Math.round((matchReport.possession.home / totalPossession) * 100);
    matchReport.possession.away = Math.round((matchReport.possession.away / totalPossession) * 100);

    return { eventLog, matchReport };
  }
};

function generateMicroEvents(rng, minute, homeTeam, awayTeam) {
  const events = [];
  const eventCount = Math.floor(rng.next() * 5) + 1; // 1-5 events per minute

  for (let i = 0; i < eventCount; i++) {
    const eventType = getRandomEventType(rng, homeTeam, awayTeam);
    const teamId = rng.next() > 0.5 ? 'club-1' : 'club-2';
    const playerId = `player-${Math.floor(rng.next() * 23)}`;
    const x = rng.next();
    const y = rng.next();

    events.push({
      fixtureId: 'fixture-1',
      timestamp: minute * 60 + Math.floor(rng.next() * 60),
      seedIndex: i,
      eventType,
      teamId,
      playerId,
      x,
      y,
      meta: {}
    });
  }

  return events;
}

function getRandomEventType(rng, homeTeam, awayTeam) {
  // Calculate team strengths
  const homeStrength = homeTeam.overall;
  const awayStrength = awayTeam.overall;

  // Adjust probabilities based on team strengths
  const totalStrength = homeStrength + awayStrength;
  const homeProbability = homeStrength / totalStrength;
  const awayProbability = awayStrength / totalStrength;

  // Event probabilities
  const eventProbabilities = {
    possession: 0.5,
    shot: 0.2,
    pass: 0.2,
    tackle: 0.05,
    foul: 0.03,
    corner: 0.02,
    yellowCard: 0.01,
    redCard: 0.005,
    goal: 0.002
  };

  // Adjust probabilities based on team strengths
  if (rng.next() < homeProbability) {
    eventProbabilities.shot *= 1.2;
    eventProbabilities.goal *= 1.5;
    eventProbabilities.corner *= 1.3;
  } else {
    eventProbabilities.shot *= 1.2;
    eventProbabilities.goal *= 1.5;
    eventProbabilities.corner *= 1.3;
  }

  // Normalize probabilities
  const totalProbability = Object.values(eventProbabilities).reduce((a, b) => a + b, 0);
  for (const key in eventProbabilities) {
    eventProbabilities[key] /= totalProbability;
  }

  // Select event type
  const rand = rng.next();
  let sum = 0;

  for (const [type, probability] of Object.entries(eventProbabilities)) {
    sum += probability;
    if (rand < sum) {
      return type;
    }
  }

  return 'pass'; // Default event type
}
