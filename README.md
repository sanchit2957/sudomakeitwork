# Assam Rescue Platform

A full-stack disaster-response platform for managing rescue requests, responders, hospitals, emergency resources, authentication, notifications, and related workflows.

## Tech Stack

- React + TypeScript
- Vite
- Express.js
- tRPC
- Drizzle ORM
- MySQL
- Tailwind CSS
- Capacitor / Android
- Vitest
- Leaflet

## Requirements

- Node.js 18+
- npm
- Git
- MySQL

## Setup

Clone the repository:

git clone https://github.com/sanchit2957/sudomakeitwork.git
cd sudomakeitwork

Install dependencies:

npm install

Create a `.env` file in the project root and add the required environment variables.

Example:

NODE_ENV=development
DATABASE_URL=
JWT_SECRET=
VAPID_SUBJECT=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

Never commit real credentials or private keys to GitHub.

## Run Locally

Start the development server:

npm run dev

The terminal will show the local URL where the application is running.

## Build

npm run build

## Start Production Build

npm start

## Database

npm run db:push

Make sure DATABASE_URL is configured before running this command.

## Testing

Run tests:

npm test

Run TypeScript checks:

npm run check

## Android

Sync the Capacitor project:

npm run cap:sync

Open the Android project:

npm run cap:open

## Project Structure

android/        Android / Capacitor project
client/         React frontend
drizzle/        Database schema and migrations
patches/        Package patches
server/         Backend and API
shared/         Shared types and utilities

## Development Workflow

Create a branch:

git checkout -b feature-name

Install dependencies:

npm install

Run the application:

npm run dev

Check the project before committing:

npm run check
npm test
npm run build

Commit changes:

git add .
git commit -m "Describe the change"

Push the branch:

git push -u origin feature-name

## Security

Never commit:

- .env files
- Database passwords
- JWT secrets
- API keys
- OAuth credentials
- VAPID private keys
- Other production secrets

Keep sensitive values in environment variables.

## Troubleshooting

If dependencies are missing:

npm install

If TypeScript has errors:

npm run check

If tests fail:

npm test

If the database cannot connect, check DATABASE_URL and make sure the database is running.

If push notifications fail, verify that VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY belong to the same generated key pair.
