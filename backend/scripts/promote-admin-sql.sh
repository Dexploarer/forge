#!/bin/bash

# Promote user to admin by wallet address using direct SQL

WALLET_ADDRESS="$1"

if [ -z "$WALLET_ADDRESS" ]; then
  echo "❌ Usage: ./scripts/promote-admin-sql.sh <wallet-address>"
  echo "   Example: ./scripts/promote-admin-sql.sh 0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef"
  exit 1
fi

echo "🔍 Checking for user with wallet address: $WALLET_ADDRESS"

# Check if user exists
railway run psql $DATABASE_URL -c "SELECT id, display_name, email, wallet_address, role FROM users WHERE wallet_address = '$WALLET_ADDRESS';"

echo ""
echo "🔄 Promoting user to admin..."

# Update user role to admin
railway run psql $DATABASE_URL -c "UPDATE users SET role = 'admin', updated_at = NOW() WHERE wallet_address = '$WALLET_ADDRESS' RETURNING id, display_name, email, wallet_address, role;"

echo ""
echo "✅ User promoted! They can now access /admin"
