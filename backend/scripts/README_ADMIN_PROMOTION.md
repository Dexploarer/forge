# How to Promote a User to Admin

There are multiple ways to promote a user to admin role. Choose the method that works best for you.

## Prerequisites

**IMPORTANT**: The user must log in to the frontend at least once before they can be promoted. When a user logs in via Privy, their account is automatically created in the database.

Your wallet address: `0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef`

---

## Method 1: Railway Dashboard (RECOMMENDED - Easiest)

This is the fastest and most reliable method:

1. Go to [Railway Dashboard](https://railway.app/)
2. Select your project
3. Click on your **Postgres** database service
4. Click on the **Query** tab
5. Copy and paste the SQL from `PROMOTE_TO_ADMIN.sql`
6. Click **Run** or press `Cmd+Enter`

The SQL will:
- Check if your user exists
- Promote you to admin
- Verify the change

---

## Method 2: Using the TypeScript Script (Local/Remote DB)

If you have access to the database from your machine:

```bash
# For Railway database (from project root)
cd backend
DATABASE_URL="<your-railway-database-url>" bun scripts/promote-admin.ts 0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef

# For local database
cd backend
bun scripts/promote-admin.ts 0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef
```

**Note**: If this times out, use Method 1 instead.

---

## Method 3: Railway CLI

If you have Railway CLI installed:

```bash
cd backend

# Run the script using Railway's environment
railway run bun scripts/promote-admin.ts 0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef
```

---

## Method 4: Direct SQL via psql

If you have psql installed and Railway CLI:

```bash
# Check if user exists
railway run psql -c "SELECT id, display_name, wallet_address, role FROM users WHERE wallet_address = '0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef';"

# Promote to admin
railway run psql -c "UPDATE users SET role = 'admin', updated_at = NOW() WHERE wallet_address = '0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef' RETURNING display_name, role;"
```

---

## Troubleshooting

### User Not Found
**Problem**: Query returns no results

**Solution**:
1. Make sure you've logged in to the frontend at least once
2. Go to `http://localhost:5173` (or your deployed frontend URL)
3. Log in with your wallet address: `0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef`
4. After successful login, retry the promotion

### Database Connection Timeout
**Problem**: Script or connection times out

**Solution**: Use Method 1 (Railway Dashboard) instead - it's the most reliable

### User Already Admin
**Problem**: User is already an admin

**Solution**: You're all set! Go to `/admin` to access the admin panel

---

## Verifying Admin Access

After promotion, verify admin access:

1. Log in to the frontend
2. Navigate to `/admin`
3. You should see the admin panel with 4 tabs:
   - Overview (platform statistics)
   - Users (user management)
   - Activity (activity feed)
   - Whitelist (wallet management)

---

## Additional Admin Management

### List all users
```bash
cd backend
bun scripts/list-users.ts
```

### Promote another user
Just replace the wallet address in any of the methods above with the target user's wallet address.

### Demote an admin to member
```sql
UPDATE users
SET role = 'member', updated_at = NOW()
WHERE wallet_address = '<wallet-address>'
RETURNING display_name, role;
```

---

## Quick Reference: User Roles

- **admin**: Full access to admin panel, can manage users, view activity
- **member**: Standard user access, can create projects and assets
- **guest**: Limited access (read-only)
