import { z } from 'zod'

// Every schema module imports Zod from here, so this runs before any schema is used, and Zod
// stays out of the main chunk (it loads with the schemas: services/api.js).
//
// S8: Zod 4 checks whether it may compile validators with `new Function` (eval). The CSP has no
// 'unsafe-eval', so that check would be reported as a CSP violation wherever input is validated.
// jitless makes Zod use its interpreter and never try.
z.config({ jitless: true })

export { z }
