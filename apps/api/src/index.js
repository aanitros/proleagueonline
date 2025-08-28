import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { matchEngine } from './matchEngine.js';
import { pcg32 } from './pcg32.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import ConnectMongoDBSession from 'connect-mongo';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { faker } from '@faker-js/faker';
import _ from 'lodash';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const prisma = new PrismaClient();
const matchQueue = new Queue('matches', { connection: { host: 'localhost' } });

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const MongoStore = ConnectMongoDBSession(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: process.env.DATABASE_URL,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Passport configuration
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-jwt-secret'
};

passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: jwtPayload.id } });
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (err) {
    return done(err, false);
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authentication routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword
      }
    });

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '1h' }
    );

    res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', passport.authenticate('local', { session: false }), (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, username: req.user.username },
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: '1h' }
  );

  res.json({ user: { id: req.user.id, username: req.user.username, email: req.user.email }, token });
});

// Protected routes
app.get('/api/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Data pack import route
app.post('/api/import-pack', upload.single('pack'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the JSON data from the uploaded file
    const packData = JSON.parse(req.file.buffer.toString());

    // Validate the pack data structure
    if (!packData.metadata || !packData.competitions || !packData.clubs) {
      return res.status(400).json({ error: 'Invalid data pack format' });
    }

    // Create a new data pack record
    const dataPack = await prisma.dataPack.create({
      data: {
        name: packData.metadata.name,
        version: packData.metadata.version,
        season: packData.metadata.season,
        licensed: packData.metadata.licensed || false,
        disclaimer: packData.metadata.disclaimer || '',
        data: packData
      }
    });

    // Import competitions
    for (const competitionData of packData.competitions) {
      const competition = await prisma.competition.create({
        data: {
          name: competitionData.name,
          country: competitionData.country,
          type: competitionData.type,
          tier: competitionData.tier,
          dataPackId: dataPack.id
        }
      });

      // Import clubs for this competition
      for (const clubId of competitionData.clubs) {
        const clubData = packData.clubs.find(c => c.id === clubId);
        if (clubData) {
          const club = await prisma.club.create({
            data: {
              name: clubData.name,
              country: clubData.country,
              competitionId: competition.id,
              stadium: clubData.stadium,
              manager: clubData.manager || '',
              balance: clubData.balance || 0,
              dataPackId: dataPack.id
            }
          });

          // Import players for this club
          for (const playerData of clubData.players) {
            await prisma.player.create({
              data: {
                firstName: playerData.firstName,
                lastName: playerData.lastName,
                age: playerData.age,
                position: playerData.position,
                clubId: club.id,
                attributes: playerData.attributes,
                contract: playerData.contract,
                condition: playerData.condition || 100,
                morale: playerData.morale || 100,
                dataPackId: dataPack.id
              }
            });
          }
        }
      }
    }

    // Import fixtures if they exist
    if (packData.fixtures) {
      for (const fixtureData of packData.fixtures) {
        await prisma.fixture.create({
          data: {
            homeClubId: fixtureData.home,
            awayClubId: fixtureData.away,
            date: new Date(fixtureData.date),
            competitionId: await prisma.competition.findFirst({
              where: { id: fixtureData.competitionId },
              select: { id: true }
            }).then(comp => comp?.id),
            dataPackId: dataPack.id
          }
        });
      }
    }

    res.json({ message: 'Data pack imported successfully', dataPackId: dataPack.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import data pack' });
  }
});

// Universe routes
app.get('/api/universes', async (req, res) => {
  try {
    const universes = await prisma.universe.findMany({
      include: {
        competitions: {
          include: {
            clubs: true
          }
        },
        matches: true
      }
    });
    res.json(universes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/universes/:id', async (req, res) => {
  try {
    const universe = await prisma.universe.findUnique({
      where: { id: req.params.id },
      include: {
        competitions: {
          include: {
            clubs: true
          }
        },
        matches: true
      }
    });
    res.json(universe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Competition routes
app.get('/api/competitions', async (req, res) => {
  try {
    const competitions = await prisma.competition.findMany({
      include: {
        clubs: true,
        matches: true
      }
    });
    res.json(competitions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/competitions/:id', async (req, res) => {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        clubs: true,
        matches: true
      }
    });
    res.json(competition);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Club routes
app.get('/api/clubs', async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: {
        players: true,
        matches: true
      }
    });
    res.json(clubs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/clubs/:id', async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.params.id },
      include: {
        players: true,
        matches: true
      }
    });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Player routes
app.get('/api/players', async (req, res) => {
  try {
    const players = await prisma.player.findMany({
      include: {
        club: true,
        matches: true
      }
    });
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/players/:id', async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: {
        club: true,
        matches: true
      }
    });
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Match routes
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      include: {
        homeClub: true,
        awayClub: true,
        events: true
      }
    });
    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/matches/:id', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        homeClub: true,
        awayClub: true,
        events: true
      }
    });
    res.json(match);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Data pack routes
app.get('/api/data-packs', async (req, res) => {
  try {
    const dataPacks = await prisma.dataPack.findMany();
    res.json(dataPacks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/data-packs/:id', async (req, res) => {
  try {
    const dataPack = await prisma.dataPack.findUnique({
      where: { id: req.params.id }
    });
    res.json(dataPack);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('join_lobby', async ({ userId, universeId }) => {
    try {
      const universe = await prisma.universe.findUnique({
        where: { id: universeId },
        include: {
          competitions: {
            include: {
              clubs: true
            }
          },
          matches: true
        }
      });

      if (universe) {
        socket.join(universeId);
        io.to(universeId).emit('lobby_update', universe);
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('player_action', async ({ actionId, type, payload, clientTS, expectedVersion }) => {
    try {
      // Process player action
      // In a real implementation, you would validate and process the action here
      socket.emit('action_ack', { status: 'success', actionId });
    } catch (err) {
      console.error(err);
      socket.emit('action_ack', { status: 'error', actionId, error: 'Internal server error' });
    }
  });

  socket.on('simulate_match', async ({ fixtureId, universeSeed, fixtureSeed }) => {
    try {
      // Simulate match
      const result = matchEngine.simulateMatch(fixtureId, universeSeed, fixtureSeed);

      // Save to database
      const match = await prisma.match.create({
        data: {
          fixtureId,
          universeId: 'universe-1',
          competitionId: 'competition-1',
          homeClubId: 'club-1',
          awayClubId: 'club-2',
          homeScore: result.matchReport.homeScore,
          awayScore: result.matchReport.awayScore,
          date: new Date(),
          eventLog: result.eventLog,
          matchReport: result.matchReport
        }
      });

      // Broadcast result
      io.emit('match_result', result.matchReport);
    } catch (err) {
      console.error(err);
      socket.emit('match_error', { error: 'Failed to simulate match' });
    }
  });

  socket.on('advance_day', async ({ universeId }) => {
    try {
      // Advance the universe by one day
      const universe = await prisma.universe.findUnique({
        where: { id: universeId },
        include: {
          competitions: {
            include: {
              clubs: {
                include: {
                  players: true
                }
              }
            }
          }
        }
      });

      if (universe) {
        // Update player conditions
        for (const competition of universe.competitions) {
          for (const club of competition.clubs) {
            for (const player of club.players) {
              // Update player condition based on training and fatigue
              const newCondition = Math.min(100, player.condition + 5);
              await prisma.player.update({
                where: { id: player.id },
                data: { condition: newCondition }
              });
            }
          }
        }

        // Update universe date
        const newDate = new Date(universe.currentDate);
        newDate.setDate(newDate.getDate() + 1);

        await prisma.universe.update({
          where: { id: universeId },
          data: { currentDate: newDate }
        });

        // Get updated universe
        const updatedUniverse = await prisma.universe.findUnique({
          where: { id: universeId },
          include: {
            competitions: {
              include: {
                clubs: {
                  include: {
                    players: true
                  }
                }
              }
            },
            matches: true
          }
        });

        // Broadcast day advanced
        io.to(universeId).emit('day_advanced', updatedUniverse);
      }
    } catch (err) {
      console.error(err);
      socket.emit('day_advance_error', { error: 'Failed to advance day' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
