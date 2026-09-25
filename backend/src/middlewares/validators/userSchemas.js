import { z } from 'zod'

const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
const LINKEDIN_URL = /^(?:https?:\/\/)?(?:[\w]+\.)?linkedin\.com\/in\/([\w\-%]{3,100})\/?$/i
const LINKEDIN_SLUG = /^[\w\-%]{3,100}$/

// Same rules as the frontend: accept a handle or a profile link, store one canonical form, null disconnects.
const github = z.string().trim().nullable().transform((value, ctx) => {
  if (!value) return null
  const username = value.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@/, '').replace(/\/+$/, '')
  if (GITHUB_USER.test(username)) return username
  ctx.addIssue({ code: 'custom', message: 'Enter a GitHub username or a github.com profile link.' })
  return z.NEVER
})

const linkedin = z.string().trim().nullable().transform((value, ctx) => {
  if (!value) return null
  const slug = value.match(LINKEDIN_URL)?.[1] ?? value
  if (LINKEDIN_SLUG.test(slug)) return `https://www.linkedin.com/in/${slug}`
  ctx.addIssue({ code: 'custom', message: 'Enter a LinkedIn profile link, like linkedin.com/in/your-name.' })
  return z.NEVER
})

export const updateMeSchema = z.object({
  connections: z.object({ github: github.optional(), linkedin: linkedin.optional() }),
})
