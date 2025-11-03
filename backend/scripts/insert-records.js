const postgres = require('postgres');
const sql = postgres('postgresql://postgres:EqSZhuIHEBzZZpQXGyYpvydLRhurAVHi@interchange.proxy.rlwy.net:46923/railway');

async function insertRecords() {
  try {
    console.log('Inserting assets...');

    // Get first user
    const users = await sql`SELECT id FROM users LIMIT 1`;
    if (users.length === 0) {
      console.log('No users found!');
      process.exit(1);
    }
    const ownerId = users[0].id;
    console.log('Using owner ID:', ownerId);

    // Insert assets
    const assets = await sql`
      INSERT INTO assets (owner_id, name, type, file_url, status, visibility)
      VALUES
        (${ownerId}, 'Sample Armor Model', 'model', 'https://bucket-staging-4c7a.up.railway.app/3d-models/0078445c-e722-44d8-b23d-798a4f5d4a96.glb', 'published', 'public'),
        (${ownerId}, 'Sample Character Model', 'model', 'https://bucket-staging-4c7a.up.railway.app/3d-models/0cce9e16-5cf8-4888-99a5-ad97c3c18a09.glb', 'published', 'public'),
        (${ownerId}, 'Sample Weapon Model', 'model', 'https://bucket-staging-4c7a.up.railway.app/3d-models/13722641-845d-4237-aef4-ce3822b6514c.glb', 'published', 'public'),
        (${ownerId}, 'Sample Environment Model', 'model', 'https://bucket-staging-4c7a.up.railway.app/3d-models/15ca047a-6484-4c3c-ae02-ee6b8b11029c.glb', 'published', 'public'),
        (${ownerId}, 'Sample Texture 1', 'texture', 'https://bucket-staging-4c7a.up.railway.app/3d-models/13389e2b-0ef1-45ac-a5d5-ae5a10818133.png', 'published', 'public'),
        (${ownerId}, 'Sample Texture 2', 'texture', 'https://bucket-staging-4c7a.up.railway.app/images/625910a4-ed16-46ea-9fff-c1a88cb7c9d1.png', 'published', 'public'),
        (${ownerId}, 'Sample Texture 3', 'texture', 'https://bucket-staging-4c7a.up.railway.app/images/6d6307b0-fd34-4f06-8b01-8f3f7826dee0.png', 'published', 'public')
      RETURNING id
    `;
    console.log(`✓ Inserted ${assets.length} assets`);

    // Insert music
    const music = await sql`
      INSERT INTO music_tracks (name, audio_url, status)
      VALUES
        ('Sample Battle Theme', 'https://bucket-staging-4c7a.up.railway.app/audio/003d4895-b92f-4e39-90a9-dda547edf555.mp3', 'published'),
        ('Sample Ambient Track', 'https://bucket-staging-4c7a.up.railway.app/audio/01147a82-584b-4d47-8022-c023cb29fb34.mp3', 'published'),
        ('Sample Menu Music', 'https://bucket-staging-4c7a.up.railway.app/audio/012fb20f-9efb-4ce9-8ddd-bfb370d87c78.mp3', 'published'),
        ('Sample Victory Theme', 'https://bucket-staging-4c7a.up.railway.app/audio/019c1491-4b20-484a-a38a-1327e1984660.mp3', 'published'),
        ('Sample Exploration Music', 'https://bucket-staging-4c7a.up.railway.app/audio/01d9103f-37b6-4c57-a0db-c8d0ee75658d.mp3', 'published')
      RETURNING id
    `;
    console.log(`✓ Inserted ${music.length} music tracks`);

    // Verify
    const assetCount = await sql`SELECT COUNT(*) as count FROM assets WHERE file_url IS NOT NULL`;
    const musicCount = await sql`SELECT COUNT(*) as count FROM music_tracks WHERE audio_url IS NOT NULL`;

    console.log('\n✅ Success!');
    console.log(`   Assets with URLs: ${assetCount[0].count}`);
    console.log(`   Music tracks with URLs: ${musicCount[0].count}`);

    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await sql.end();
    process.exit(1);
  }
}

insertRecords();
