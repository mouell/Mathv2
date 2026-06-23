#!/bin/bash
# MathV2 Setup Script

set -e

echo "╔══════════════════════════════════════╗"
echo "║        MathV2 CAD/CAM Platform       ║"
echo "║         Setup & Installation         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }

echo "✓ All prerequisites found"
echo ""

# Copy environment files
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env from .env.example"
    echo "  ℹ️  Aucune clé API externe requise — pipeline 100% local"
fi

if [ ! -f frontend/.env.local ]; then
    cp frontend/.env.example frontend/.env.local 2>/dev/null || true
fi

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env 2>/dev/null || true
fi

# Create uploads directory
mkdir -p uploads
echo "✓ Created uploads directory"

# Start PostgreSQL via Docker
echo ""
echo "Starting PostgreSQL..."
docker-compose up -d postgres
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Install dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps
cd ..

echo "Installing backend dependencies..."
cd backend && npm install
cd ..

echo "Installing AI engine dependencies..."
cd ai-engine && pip3 install -r requirements.txt -q
cd ..

# Run database migrations
echo ""
echo "Running database migrations..."
cd backend
npx prisma generate
npx prisma db push
cd ..

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Setup Complete! ✓            ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "To start the application:"
echo ""
echo "  Terminal 1: cd frontend && npm run dev"
echo "  Terminal 2: cd backend && npm run start:dev"
echo "  Terminal 3: cd ai-engine && uvicorn main:app --reload --port 8001"
echo ""
echo "  Or use: docker-compose up"
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  API Docs: http://localhost:3001/api"
echo "  AI Engine: http://localhost:8001"
