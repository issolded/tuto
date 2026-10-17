// fetch that survives a dropped connection. A long run makes thousands of requests; one ETIMEDOUT used to
// throw out of the run and stop that shard (2026-10-17: all six wordlist shards, 377 clips short).
// HTTP errors are returned as usual: the caller decides about 429 and 5xx.
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'

// Node tries each address of a host for only 250 ms before the next; on a slow connection (connect ~400 ms,
// 2026-10-17) every attempt timed out while curl connected fine. 2 s per attempt.
setDefaultAutoSelectFamilyAttemptTimeout(2000)

const sleep = ms => new Promise(r => setTimeout(r, ms))
export async function fetchRetry(url, opts, tries = 16) {   // ~15 min of waiting in all: outages here ran past 75 s
  for (let i = 1; ; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(90000) }) } catch (e) {
      if (i >= tries) throw e
      const wait = Math.min(5000 * i, 60000)
      console.log(`    network: ${e.cause?.code || e.name || e.message}, retry ${i} in ${wait / 1000} s`)
      await sleep(wait)
    }
  }
}
