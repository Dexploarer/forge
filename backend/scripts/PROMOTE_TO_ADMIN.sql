-- =====================================================
-- PROMOTE USER TO ADMIN
-- =====================================================
-- Instructions:
-- 1. Open Railway dashboard
-- 2. Click on your Postgres database
-- 3. Go to "Query" tab
-- 4. Paste and run the commands below
-- =====================================================

-- Step 1: Check if user exists with this wallet address
SELECT
  id,
  display_name,
  email,
  wallet_address,
  role,
  created_at
FROM users
WHERE wallet_address = '0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef';

-- Step 2: If user exists, promote them to admin
UPDATE users
SET
  role = 'admin',
  updated_at = NOW()
WHERE wallet_address = '0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef'
RETURNING id, display_name, email, wallet_address, role;

-- Step 3: Verify the change
SELECT
  id,
  display_name,
  email,
  wallet_address,
  role
FROM users
WHERE role = 'admin';

-- =====================================================
-- NOTES:
-- =====================================================
-- - User must log in at least once before they appear in the database
-- - If no user found, have them log in to the frontend first at /
-- - After promotion, they can access /admin
-- - You can change the wallet address above to promote different users
-- =====================================================
