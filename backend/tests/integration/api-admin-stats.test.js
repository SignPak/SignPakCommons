import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * B7: the admin dashboard is built from GET /admin/stats, so the endpoint does the counting the
 * browser used to do: per day, per category, top videos and contributors, and the recent list,
 * for a range of days and optionally one contributor or one category.
 */

const getContext = useApiContext({ after })
let admin, createVerifiedUser, mongoose
let catX, catY, x1, x2, y1, pari, qasim

const stats = async (query = '') => {
  const res = await admin.get(`/admin/stats${query}`)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body.data
}
const sum = (activity) => activity.reduce((total, day) => total + day.count, 0)
const countOf = (data, category) => data.byCategory.find((item) => item.categoryId === category.id).count

before(async () => {
  ;({ admin, createVerifiedUser, mongoose } = await getContext())
  catX = (await admin.post('/categories', { label: 'Stats X', tone: 'red' })).body.data
  catY = (await admin.post('/categories', { label: 'Stats Y', tone: 'green' })).body.data
  const video = async (title, category) => (await admin.upload('/videos', videoForm({ title, categoryId: category.id, durationSec: '3' }))).body.data
  x1 = await video('X one', catX)
  x2 = await video('X two', catX)
  y1 = await video('Y one', catY)
  const person = async (first, email) => {
    const client = await createVerifiedUser({ firstName: first, surname: 'Stats', email })
    return { client, id: (await client.get('/auth/session')).body.data.id }
  }
  pari = await person('Pari', 'pari.stats@example.com')
  qasim = await person('Qasim', 'qasim.stats@example.com')
  const submit = async (who, video) => {
    const res = await who.client.upload('/submissions', recordingForm({ videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' }))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.data.id
  }
  // In the last week: Pari x1, y1; Qasim x1, x2. Twenty days ago: Qasim y1.
  await submit(pari, x1)
  await submit(pari, y1)
  await submit(qasim, x1)
  await submit(qasim, x2)
  const old = await submit(qasim, y1)
  await mongoose.models.Submission.collection.updateOne({ _id: new mongoose.Types.ObjectId(old) }, { $set: { createdAt: new Date(Date.now() - 20 * 86_400_000) } })
})

describe('B7: GET /admin/stats with filters', () => {
  test('B7: the summary, activity, categories, top lists and recent list cover the chosen days', async () => {
    const week = await stats('?days=7')
    assert.equal(week.activity.length, 7)
    assert.equal(sum(week.activity), 4)
    assert.deepEqual(week.summary, {
      recordings: 4, activeContributors: 2, videosRecorded: 3,
      topCategory: { categoryId: catX.id, label: 'Stats X', count: 3 },
    })
    assert.equal(countOf(week, catX), 3)
    assert.equal(countOf(week, catY), 1)
    assert.deepEqual(week.topVideos[0], { videoId: x1.id, title: 'X one', categoryId: catX.id, tone: 'red', count: 2 })
    assert.deepEqual(week.topContributors.map(({ name, count }) => [name, count]), [['Pari Stats', 2], ['Qasim Stats', 2]])
    assert.equal(week.recent.length, 4)

    const month = await stats('?days=30')
    assert.equal(month.summary.recordings, 5)
    assert.equal(sum(month.activity), 5)
    assert.equal(countOf(month, catY), 2)
  })

  test('B7: userId narrows everything to one contributor', async () => {
    const data = await stats(`?days=30&userId=${qasim.id}`)
    assert.equal(data.summary.recordings, 3)
    assert.equal(data.summary.activeContributors, 1)
    assert.equal(countOf(data, catX), 2)
    assert.equal(countOf(data, catY), 1)
    assert.deepEqual(data.topContributors.map((item) => item.userId), [qasim.id])
    assert.ok(data.recent.every((item) => item.contributor.id === qasim.id))
  })

  test('B7: categoryId narrows everything to one category, and the other categories show 0', async () => {
    const data = await stats(`?days=30&categoryId=${catY.id}`)
    assert.equal(data.summary.recordings, 2)
    assert.equal(countOf(data, catY), 2)
    assert.equal(countOf(data, catX), 0)
    assert.deepEqual(data.topVideos.map((item) => item.videoId), [y1.id])
    assert.ok(data.recent.every((item) => item.category.id === catY.id))
    const both = await stats(`?days=7&categoryId=${catX.id}&userId=${pari.id}`)
    assert.equal(both.summary.recordings, 1)
  })

  test('B7: the existing fields are still there, and totals stay all-time', async () => {
    const data = await stats(`?days=7&userId=${pari.id}`)
    for (const key of ['totals', 'activity', 'byCategory', 'recent']) assert.ok(key in data, key)
    assert.equal(data.totals.submissions, 5, 'totals ignore the filters')
    assert.equal(data.totals.categories, 2)
    assert.deepEqual(Object.keys(data.recent[0]).sort(), ['category', 'contributor', 'id', 'submittedAt', 'video'])
  })

  test('B7: an empty range gives zeros and no top category', async () => {
    await mongoose.models.Submission.collection.updateMany({}, { $set: { createdAt: new Date('2020-01-01T00:00:00.000Z') } })
    const data = await stats('?days=7')
    assert.deepEqual(data.summary, { recordings: 0, activeContributors: 0, videosRecorded: 0, topCategory: null })
    assert.deepEqual(data.topVideos, [])
    assert.deepEqual(data.topContributors, [])
    assert.deepEqual(data.recent, [])
  })

  test('B7: bad filters are refused with 422', async () => {
    for (const query of ['?userId=abc', '?categoryId=1', '?days=3', '?days=91']) {
      assert.equal((await admin.get(`/admin/stats${query}`)).status, 422, query)
    }
  })
})
