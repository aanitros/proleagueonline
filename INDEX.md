# ProLeague Full Implementation

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the database and Redis:
   ```bash
   docker-compose up -d
   ```

3. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

4. Seed the database with sample data:
   ```bash
   npm run seed
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

6. Open your browser to:
   - Web app: http://localhost:5173
   - API: http://localhost:3001

## Features

- Deterministic match engine using PCG32 RNG
- Fully populated database with sample data
- Real-time updates via Socket.IO
- Match simulation and replay
- Universe and competition management

## Project Structure

- `apps/api`: Backend API and match engine
- `apps/web`: Frontend web application
- `tests`: Test files
- `prisma`: Database schema, migrations, and seed data

## Running Tests

Run the deterministic test suite:
```bash
npm run test:determinism
```
