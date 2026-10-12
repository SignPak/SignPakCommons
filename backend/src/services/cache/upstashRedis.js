import { env } from '../../config/env.js'

const configured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)

async function command(...args) {
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(2500),
  })
  if (!response.ok) throw new Error(`Upstash Redis request failed (${response.status}).`)
  const payload = await response.json()
  if (payload.error) throw new Error(`Upstash Redis command failed: ${payload.error}`)
  return payload.result
}

export const upstashRedis = {
  get enabled() {
    return configured && !env.isTest
  },

  async get(key) {
    if (!this.enabled) return null
    const result = await command('GET', key)
    if (result !== null && typeof result !== 'string') {
      throw new Error('Upstash Redis returned an invalid cache value.')
    }
    return result
  },

  async set(key, value, ttlSeconds) {
    if (!this.enabled) return
    await command('SET', key, JSON.stringify(value), 'EX', ttlSeconds)
  },
}
