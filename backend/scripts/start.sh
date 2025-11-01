#!/bin/bash
# Railway startup script
# Runs database migrations before starting the server

set -e  # Exit on any error

echo "🔄 Running database migrations..."
bun run db:migrate

echo "🚀 Starting server..."
bun run start
