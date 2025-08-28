import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a universe
  const universe = await prisma.universe.create({
    data: {
      name: 'Premier League 2025/26',
      season: '2025/26',
      universeSeed: '0x1F4A9B8C7D6E5F00'
    }
  });

  // Create competitions
  const premierLeague = await prisma.competition.create({
    data: {
      name: 'Premier League',
      country: 'England',
      type: 'league',
      tier: 1,
      clubs: [
        'club-1', 'club-2', 'club-3', 'club-4', 'club-5',
        'club-6', 'club-7', 'club-8', 'club-9', 'club-10',
        'club-11', 'club-12', 'club-13', 'club-14', 'club-15',
        'club-16', 'club-17', 'club-18', 'club-19', 'club-20'
      ]
    }
  });

  // Create clubs
  const clubs = [
    {
      id: 'club-1',
      name: 'Manchester City',
      country: 'England',
      competitionId: premierLeague.id,
      stadium: {
        name: 'Etihad Stadium',
        capacity: 53400
      },
      players: [
        {
          id: 'player-1',
          name: 'Erling Haaland',
          age: 23,
          position: 'FW',
          attributes: {
            pace: 19,
            shooting: 19,
            passing: 17,
            dribbling: 18,
            defending: 15,
            physical: 19,
            overall: 18
          },
          contract: {
            salary: 25000000,
            expires: '2027-06-30'
          },
          condition: 95,
          morale: 90
        },
        // Add more players...
      ]
    },
    {
      id: 'club-2',
      name: 'Liverpool',
      country: 'England',
      competitionId: premierLeague.id,
      stadium: {
        name: 'Anfield',
        capacity: 54074
      },
      players: [
        {
          id: 'player-2',
          name: 'Mohamed Salah',
          age: 27,
          position: 'FW',
          attributes: {
            pace: 19,
            shooting: 18,
            passing: 17,
            dribbling: 19,
            defending: 14,
            physical: 18,
            overall: 18
          },
          contract: {
            salary: 18000000,
            expires: '2021-06-30'
          },
          condition: 94,
          morale: 92
        },
        // Add more players...
      ]
    },
    // Add more clubs...
  ];

  for (const club of clubs) {
    await prisma.club.create({
      data: club
    });
  }

  // Create a match
  await prisma.match.create({
    data: {
      fixtureId: 'fixture-1',
      universeId: universe.id,
      homeId: 'club-1',
      awayId: 'club-2',
      homeScore: 2,
      awayScore: 1,
      eventLog: [],
      matchReport: {
        homeScore: 2,
        awayScore: 1,
        events: [
          { minute: 15, team: 'Home', eventType: 'goal', player: 'Player 1' },
          { minute: 30, team: 'Away', eventType: 'goal', player: 'Player 2' },
          { minute: 75, team: 'Home', eventType: 'goal', player: 'Player 1' }
        ]
      }
    }
  });

  console.log('Database seeded successfully');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
