import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * B7: GET /admin/users and the admin GET /submissions page when asked (?limit, ?cursor), and
 * answer exactly as before when not. GET /admin/users can also filter by role and search by
 * name or email; an admin's library asks GET /submissions?mine=true for its own submissions.
 */

const getContext = useApiContext({ after })
let admin, contributor, createVerifiedUser
let video

before(async () => {
  ;({ admin, contributor, createVerifiedUser } = await getContext())
  for (const [first, email] of [['Zainab', 'zainab.page@example.com'], ['Zafar', 'zafar.page@example.com'], ['Hina', 'hina.page@example.com']]) {
    await createVerifiedUser({ firstName: first, surname: 'Pager', email })
  }
  const category = (await admin.post('/categories', { label: 'Paging', tone: 'blue' })).body.data
  video = (await admin.upload('/videos', videoForm({ title: 'Paging video', categoryId: category.id, durationSec: '3' }))).body.data
})

const record = (client) => client.upload('/submissions', recordingForm({ videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' }))

describe('B7: GET /admin/users paging and search', () => {
  test('B7: without limit the answer is the full array, as before', async () => {
    const res = await admin.get('/admin/users')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
    assert.equal(res.body.data.length, 6, 'admin, Sara, Omar and three more')
  })

  test('B7: with limit, pages of { items, nextCursor, total } cover every account exactly once', async () => {
    const seen = []
    let cursor = null
    do {
      const res = await admin.get(`/admin/users?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
      assert.equal(res.status, 200)
      assert.equal(res.body.data.total, 6)
      assert.ok(res.body.data.items.length <= 2)
      seen.push(...res.body.data.items.map((user) => user.id))
      cursor = res.body.data.nextCursor
    } while (cursor)
    assert.equal(seen.length, 6)
    assert.equal(new Set(seen).size, 6)
  })

  test('B7: role and a name or email search narrow the page', async () => {
    const users = (await admin.get('/admin/users?limit=50&role=user')).body.data
    assert.equal(users.total, 5)
    assert.ok(users.items.every((user) => user.role === 'user'))
    const za = (await admin.get('/admin/users?limit=50&q=za')).body.data
    assert.deepEqual(za.items.map((user) => user.firstName).sort(), ['Zafar', 'Zainab'])
    assert.equal((await admin.get('/admin/users?limit=50&q=HINA.page')).body.data.total, 1, 'email, case-insensitive')
    assert.equal((await admin.get('/admin/users?limit=50&q=pager')).body.data.total, 3, 'surname')
  })

  test('B7: regex characters in the search are matched literally', async () => {
    for (const q of ['.*', '(', 'a|b', '\\']) {
      const res = await admin.get(`/admin/users?limit=50&q=${encodeURIComponent(q)}`)
      assert.equal(res.status, 200, q)
      assert.equal(res.body.data.total, 0, q)
    }
  })

  test('B7: bad paging values are refused with 422', async () => {
    for (const query of ['limit=0', 'limit=101', 'cursor=nope', 'role=owner']) {
      assert.equal((await admin.get(`/admin/users?${query}`)).status, 422, query)
    }
  })
})

describe('B7: GET /submissions for admins', () => {
  test('B7: ?mine=true gives an admin only their own submissions; without it, everyone\'s as before', async () => {
    assert.equal((await record(admin)).status, 201)
    assert.equal((await record(contributor)).status, 201)
    const adminId = (await admin.get('/auth/session')).body.data.id
    const all = (await admin.get('/submissions')).body.data
    assert.ok(Array.isArray(all))
    assert.equal(all.length, 2)
    const mine = (await admin.get('/submissions?mine=true')).body.data
    assert.deepEqual(mine.map((item) => item.userId), [adminId])
  })

  test('B7: ?limit gives the paged shape; a contributor still sees only their own', async () => {
    const page = (await admin.get('/submissions?limit=1')).body.data
    assert.equal(page.items.length, 1)
    assert.equal(page.total, 2)
    assert.ok(page.nextCursor)
    const next = (await admin.get(`/submissions?limit=1&cursor=${page.nextCursor}`)).body.data
    assert.equal(next.items.length, 1)
    assert.notEqual(next.items[0].id, page.items[0].id)
    assert.equal(next.nextCursor, null)

    const own = (await contributor.get('/submissions?limit=10')).body.data
    assert.equal(own.total, 1)
    assert.equal('archivePath' in own.items[0], false, 'contributors still never see archive paths')
    assert.equal((await contributor.get('/submissions?mine=false')).body.data.length, 1, 'mine=false cannot widen a contributor\'s view')
  })
})
