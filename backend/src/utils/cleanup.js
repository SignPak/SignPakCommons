import { logger } from './logger.js'

/**
 * Runs one clean-up step after a failed operation (B1). A clean-up failure is logged and
 * swallowed, so the next step still runs and the caller can rethrow the ORIGINAL error:
 *
 *   } catch (error) {
 *     await attemptCleanup('remove archived recording', () => storageService.remove(recording))
 *     await attemptCleanup('release cooldown', () => submissionRepo.releaseCooldown(user, video))
 *     throw error
 *   }
 */
export async function attemptCleanup(step, run, details = {}) {
  try {
    await run()
  } catch (error) {
    logger.error({ err: error, step, ...details }, 'Clean-up step failed; continuing')
  }
}
