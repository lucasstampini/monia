// Gera o build de produção e instala o app no sistema, para usar o monia
// como um app normal (atalho, Menu Iniciar, Launchpad) sem `npm run dev`.
//
// Windows: roda o instalador NSIS em modo silencioso (instala por usuário, sem admin).
// macOS:   copia o monia.app para /Applications.
// Linux:   copia o AppImage para ~/Applications.
//
// Os dados ficam fora da pasta do app, então reinstalar não apaga nada.
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const productName = pkg.build.productName
const dist = join(process.cwd(), 'dist')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// O instalador não substitui arquivos de um app aberto.
function closeRunningApp() {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/IM', `${productName}.exe`, '/F'], { stdio: 'ignore' })
  } else {
    spawnSync('pkill', ['-x', productName], { stdio: 'ignore' })
  }
}

function installWindows() {
  const installer = join(dist, `${productName} Setup ${pkg.version}.exe`)
  if (!existsSync(installer)) throw new Error(`Instalador não encontrado: ${installer}`)
  run(`"${installer}"`, ['/S'])
  console.log(`\n${productName} instalado. Abra pelo Menu Iniciar ou pelo atalho na Área de Trabalho.`)
}

function installMac() {
  // electron-builder deixa o .app em dist/mac, dist/mac-arm64 ou dist/mac-universal.
  const folder = readdirSync(dist).find((name) => name.startsWith('mac') && existsSync(join(dist, name, `${productName}.app`)))
  if (!folder) throw new Error(`${productName}.app não encontrado em ${dist}`)
  const target = join('/Applications', `${productName}.app`)
  rmSync(target, { recursive: true, force: true })
  cpSync(join(dist, folder, `${productName}.app`), target, { recursive: true, verbatimSymlinks: true })
  console.log(`\n${productName} instalado em ${target}. Abra pelo Launchpad ou Spotlight.`)
}

function installLinux() {
  const appImage = readdirSync(dist).find((name) => name.endsWith('.AppImage'))
  if (!appImage) throw new Error(`AppImage não encontrado em ${dist}`)
  const folder = join(homedir(), 'Applications')
  mkdirSync(folder, { recursive: true })
  const target = join(folder, `${productName}.AppImage`)
  copyFileSync(join(dist, appImage), target)
  chmodSync(target, 0o755)
  console.log(`\n${productName} copiado para ${target}.`)
}

run('npm', ['run', 'dist'])
closeRunningApp()

if (process.platform === 'win32') installWindows()
else if (process.platform === 'darwin') installMac()
else installLinux()
