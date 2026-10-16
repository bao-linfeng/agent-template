import { FAKE_MALWARE, FAKE_SCAN_ERROR } from './support/fake-clamd.js'
import {
  CLIENT_API,
  createTestApp,
  registerUser,
  type TestApp,
} from './support/test-app.js'

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const png = (marker = '') =>
  Buffer.concat([PNG_HEADER, Buffer.alloc(64, 1), Buffer.from(marker)])

/** The e2e setup points `CLAMAV_HOST` at a fake clamd that flags `FAKE_MALWARE` and fails on `FAKE_SCAN_ERROR`. */
describe('upload malware scan (e2e)', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(async () => {
    await t.close()
  })

  it('rejects infected avatars and keeps the current one', async () => {
    const { agent } = await registerUser(t)
    const uploaded = await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', png(), 'me.png')
      .expect(200)

    const infected = await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', png(FAKE_MALWARE), 'me.png')
      .expect(422)
    expect(infected.body).toMatchObject({ code: 'UPLOAD_INFECTED' })

    const unavailable = await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', png(FAKE_SCAN_ERROR), 'me.png')
      .expect(503)
    expect(unavailable.body).toMatchObject({ code: 'UPLOAD_SCAN_UNAVAILABLE' })

    const me = await agent.get(`${CLIENT_API}/users/me`).expect(200)
    expect(me.body.avatarUrl).toBe(uploaded.body.avatarUrl)
  })

  it('rejects infected knowledge base files before storing them', async () => {
    const { agent } = await registerUser(t)
    const kb = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases`)
      .send({ name: 'Scanned' })
      .expect(201)
    const documents = `${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents`

    const infected = await agent
      .post(documents)
      .attach('file', Buffer.from(`notes ${FAKE_MALWARE}`), 'notes.txt')
      .expect(422)
    expect(infected.body).toMatchObject({ code: 'UPLOAD_INFECTED' })
    await agent
      .post(documents)
      .attach('file', Buffer.from(`notes ${FAKE_SCAN_ERROR}`), 'notes.txt')
      .expect(503)
    await agent
      .post(documents)
      .attach('file', Buffer.from('clean notes'), 'notes.txt')
      .expect(201)

    const list = await agent.get(documents).expect(200)
    expect(list.body.total).toBe(1)
  })
})
