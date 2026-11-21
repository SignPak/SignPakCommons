import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { filesIn, recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * SECURITY (FIX-PLAN 4.5 "wrong file types rejected", checklist B6): the browser-supplied
 * Content-Type and file name are attacker-controlled, so every upload route must decide from
 * the bytes. Each disguise below is labelled video/mp4 and named .mp4.
 */

const isoMedia = (major, compatible = ['isom', 'mp42']) => Buffer.concat([
  Buffer.from([0, 0, 0, 8 + 4 + 4 + compatible.length * 4]), Buffer.from('ftyp'), Buffer.from(major, 'latin1'), Buffer.alloc(4),
  ...compatible.map((brand) => Buffer.from(brand, 'latin1')),
  Buffer.alloc(2000, 3),
])

const DISGUISES = {
  'M4A audio': isoMedia('M4A '),
  'HEIC photo': isoMedia('heic', ['mif1', 'heic']),
  'AVIF image': isoMedia('avif', ['mif1', 'miaf']),
  '3GP clip': isoMedia('3gp4'),
  '3G2 clip': isoMedia('3g2a'),
  'plain text': Buffer.from('this is not a video at all, just text pretending'),
  'JPEG image': Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 1)]),
}

const getContext = useApiContext({ after })
let admin, contributor, video

before(async () => {
  const context = await getContext()
  ;({ admin, contributor } = context)
  const category = (await admin.post('/categories', { label: 'Upload types', tone: 'blue' })).body.data
  video = (await admin.upload('/videos', videoForm({ title: 'Reference', categoryId: category.id, durationSec: '3' }))).body.data
})

const fileForm = (fields, field, bytes) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append(field, new Blob([bytes], { type: 'video/mp4' }), 'innocent.mp4')
  return form
}

describe('security: upload content types', () => {
  test('B6: disguised files are rejected on the contributor recording route', async () => {
    for (const [name, bytes] of Object.entries(DISGUISES)) {
      const res = await contributor.upload('/submissions', recordingForm(
        { videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' },
        { file: bytes, type: 'video/mp4' },
      ))
      assert.equal(res.status, 422, `${name}: ${JSON.stringify(res.body)}`)
      assert.equal(res.body.error.code, 'VALIDATION_ERROR')
    }
    assert.deepEqual(filesIn('commons'), [], 'nothing reached the archive')
  })

  test('B6: disguised files are rejected on the reference video route', async () => {
    for (const [name, bytes] of Object.entries(DISGUISES)) {
      const res = await admin.upload('/videos', fileForm({ title: `Disguised ${name}`, status: 'draft' }, 'video', bytes))
      assert.equal(res.status, 422, `${name}: ${JSON.stringify(res.body)}`)
    }
  })

  test('B6: disguised files are rejected on the demo video route', async () => {
    for (const [name, bytes] of Object.entries(DISGUISES)) {
      const res = await admin.upload('/demo-video', fileForm({ title: `Disguised ${name}` }, 'video', bytes))
      assert.equal(res.status, 422, `${name}: ${JSON.stringify(res.body)}`)
    }
    assert.deepEqual(filesIn('tmp'), [], 'rejected uploads leave no temp files')
  })
})
