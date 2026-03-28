import { spawn } from 'node:child_process'
import path from 'node:path'
import http from 'node:http'

const nodeCmd = process.execPath

function checkBackendHealth({ port, timeoutMs = 800 } = {}) {
  const p = Number.parseInt(String(port ?? 3001), 10) || 3001
  return new Promise((resolve) => {
    const req = http.get(
      { host: 'localhost', port: p, path: '/health', timeout: timeoutMs },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', () => resolve(false))
  })
}

function checkViteRunning({ port, timeoutMs = 600 } = {}) {
  const p = Number.parseInt(String(port ?? 5173), 10) || 5173
  return new Promise((resolve) => {
    const req = http.get(
      { host: 'localhost', port: p, path: '/@vite/client', timeout: timeoutMs },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', () => resolve(false))
  })
}

function run(label, cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    ...options,
  })
  child.on('exit', (code, signal) => {
    if (signal) return
    if (code && code !== 0) {
      console.error(`\n[${label}] saiu com código ${code}`)
      process.exit(code)
    }
  })
  return child
}

const backendPort = Number.parseInt(process.env.BACKEND_PORT ?? '3001', 10) || 3001
const backendAlreadyRunning = await checkBackendHealth({ port: backendPort })

const backend = backendAlreadyRunning
  ? null
  : run('backend', nodeCmd, ['src/index.js'], {
      cwd: path.resolve('backend'),
      env: { ...process.env, PORT: String(backendPort) },
    })

if (backendAlreadyRunning) {
  console.log(`[dev] backend já está a correr em http://localhost:${backendPort} (OK)`)
}

const frontendPort = Number.parseInt(process.env.FRONTEND_PORT ?? '5173', 10) || 5173
const frontendAlreadyRunning = await checkViteRunning({ port: frontendPort })

const frontend = frontendAlreadyRunning
  ? null
  : run('frontend', nodeCmd, [path.resolve('node_modules/vite/bin/vite.js'), '--configLoader', 'native'])

if (frontendAlreadyRunning) {
  console.log(`[dev] frontend já está a correr em http://localhost:${frontendPort} (Vite)`)
}

function shutdown() {
  try {
    backend?.kill('SIGINT')
  } catch {}
  try {
    frontend?.kill('SIGINT')
  } catch {}
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(0)
})
