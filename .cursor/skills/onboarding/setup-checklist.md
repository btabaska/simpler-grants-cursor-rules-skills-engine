# Environment Setup Checklist

## Prerequisites
- [ ] Git installed
- [ ] Node.js 20+ installed
- [ ] Python 3.12+ installed
- [ ] Docker Desktop installed and running
- [ ] Cursor IDE installed

## Clone and Install
- [ ] Clone the repository: `git clone https://github.com/HHS/simpler-grants-gov.git`
- [ ] Install API dependencies: `cd api && make init`
- [ ] Install frontend dependencies: `cd frontend && npm install`
- [ ] Copy environment files: `cp .env.example .env` in both api/ and frontend/

## Database Setup
- [ ] Start PostgreSQL via Docker: `docker compose up -d`
- [ ] Run migrations: `cd api && make db-migrate`
- [ ] Seed data (if available): `cd api && make db-seed`

## Verify Everything Works
- [ ] API tests pass: `cd api && make test`
- [ ] Frontend tests pass: `cd frontend && npm test`
- [ ] API server starts: `cd api && make run`
- [ ] Frontend dev server starts: `cd frontend && npm run dev`

## Cursor IDE Setup
- [ ] Install Cursor extensions (if any recommended)
- [ ] Verify `.cursor/rules/` directory exists with rule files
- [ ] Verify `.cursor/agents/` directory exists with agent files
- [ ] Verify `.cursor/commands/` directory exists with command files
- [ ] Verify MCP servers connect: check Cursor's MCP panel
- [ ] Test a slash command: try `/explain-architecture` on any file

## Optional
- [ ] Install Compound Engineering plugin for specialist reviews
- [ ] Install Compound Knowledge plugin for documentation indexing
- [ ] Set up GitHub PAT for MCP GitHub server
