import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve('data')
fs.mkdirSync(dataDir, { recursive: true })
const logFile = path.join(dataDir, 'server.log')

function write(level: string, message: string, meta?: unknown) {
  const line = `${new Date().toISOString()} [${level}] ${message}`
  if (meta !== undefined) console[level === 'ERROR' ? 'error' : 'log'](line, meta)
  else console[level === 'ERROR' ? 'error' : 'log'](line)
  fs.appendFileSync(logFile, line + (meta !== undefined ? ` ${JSON.stringify(meta)}` : '') + '\n')
}

export const logger = {
  info: (message: string, meta?: unknown) => write('INFO', message, meta),
  error: (message: string, meta?: unknown) => write('ERROR', message, meta),
}
