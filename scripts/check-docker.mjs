import { execSync } from 'node:child_process'

try {
  execSync('docker info', { stdio: 'ignore' })
} catch {
  console.error('')
  console.error('Docker não está rodando.')
  console.error('')
  console.error('No Windows: abra o Docker Desktop e aguarde ficar "Running".')
  console.error('Depois execute novamente:')
  console.error('  npm run setup')
  console.error('  npm run dev:apps')
  console.error('')
  console.error('Ou tudo de uma vez (com Docker já aberto):')
  console.error('  npm run dev:all')
  console.error('')
  process.exit(1)
}
