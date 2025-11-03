// Quick test of GitHub API access
const GITHUB_API_BASE = 'https://api.github.com/repos/HyperscapeAI/assets/contents'

async function testGitHubAccess() {
  console.log('Testing GitHub API access...\n')

  try {
    // Test 1: Fetch models directory
    console.log('1. Fetching models directory...')
    const modelsResponse = await fetch(`${GITHUB_API_BASE}/models`)
    if (!modelsResponse.ok) {
      throw new Error(`GitHub API error: ${modelsResponse.statusText}`)
    }
    const modelsContents = await modelsResponse.json() as Array<{ name: string; type: string }>
    const modelDirs = modelsContents.filter(item => item.type === 'dir')
    console.log(`   ✅ Found ${modelDirs.length} model directories`)
    console.log(`   First 5: ${modelDirs.slice(0, 5).map(d => d.name).join(', ')}`)

    // Test 2: Fetch sword-base directory
    console.log('\n2. Fetching sword-base directory...')
    const swordResponse = await fetch(`${GITHUB_API_BASE}/models/sword-base`)
    if (!swordResponse.ok) {
      throw new Error(`Failed to fetch sword-base: ${swordResponse.statusText}`)
    }
    const swordContents = await swordResponse.json() as Array<{ name: string; size: number }>
    console.log(`   ✅ Found ${swordContents.length} files:`)
    swordContents.forEach(file => {
      console.log(`      - ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    })

    // Test 3: Fetch metadata.json
    console.log('\n3. Fetching metadata.json...')
    const metadataResponse = await fetch(
      'https://raw.githubusercontent.com/HyperscapeAI/assets/main/models/sword-base/metadata.json'
    )
    if (!metadataResponse.ok) {
      throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`)
    }
    const metadata = await metadataResponse.json()
    console.log(`   ✅ Metadata loaded:`)
    console.log(`      Name: ${metadata.name}`)
    console.log(`      Type: ${metadata.type}`)
    console.log(`      Subtype: ${metadata.subtype}`)
    console.log(`      Material variants: ${metadata.materialVariants?.join(', ') || 'none'}`)
    console.log(`      Workflow: ${metadata.workflow}`)

    console.log('\n✨ All tests passed! GitHub import will work.')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testGitHubAccess()
