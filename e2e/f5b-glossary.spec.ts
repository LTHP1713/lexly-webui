/**
 * F5b golden path (plan F5b "Done when", UI spec F5b). Needs the backend on Phase 5b. Setup makes
 * its own content through the admin API: an act with two sections that share one key term, and a
 * case law with one legal principle, all with a per-run stamp so a search finds only them. Then:
 * SUPERADMIN opens Vocab from the Library sub-nav, sees the shared term once and opens the first
 * section; a fresh S_STUDENT reaches Vocab from the Study hub, switches to Maxims and opens the
 * case law. Everything made here is deleted afterwards.
 */
import { expect, test, type APIRequestContext } from '@playwright/test'
import { API, login, loginAndSettle } from './api'
import { SUPERADMIN, expectNoAxeViolations, signInWithEmail, superadminSignIn } from './support'

const STAMP = Date.now().toString(36).toLowerCase()
const TERM = `Zeugmatic ${STAMP}`
const MAXIM = `Quietus ${STAMP}`
const SOLO_EMAIL = `f5b.solo.${STAMP}@example.com`
const PASSWORD = 'my-own-pass-123'

test.describe.configure({ mode: 'serial' })

const made: { actId?: string; firstSectionId?: string; caseLawId?: string } = {}

async function call(request: APIRequestContext, token: string, method: string, path: string, data?: unknown) {
  const response = await request.fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true)
  return response.status() === 204 ? null : response.json()
}

async function superToken(request: APIRequestContext) {
  return (
    (await login(request, { email: SUPERADMIN.email, password: SUPERADMIN.newPassword })) ??
    (await loginAndSettle(request, { email: SUPERADMIN.email, password: SUPERADMIN.password }, SUPERADMIN.newPassword))
  )
}

function section(sectionNumber: string, definition: string) {
  return {
    sectionNumber,
    title: `F5b section ${sectionNumber}`,
    bodyText: `Body of section ${sectionNumber}.`,
    keyLegalTerms: [{ term: TERM, definition, displayOrder: 0 }],
  }
}

test.beforeAll(async ({ request }) => {
  const token = await superToken(request)
  const vocab = await request.get(`${API}/vocab?size=1`, { headers: { Authorization: `Bearer ${token}` } })
  test.skip(vocab.status() === 404, 'The backend has no /vocab; run lexly-backend on main (Phase 5b)')
})

test.afterAll(async ({ request }) => {
  const token = await superToken(request)
  if (made.caseLawId) await call(request, token, 'DELETE', `/admin/caselaws/${made.caseLawId}`)
  if (made.actId) await call(request, token, 'DELETE', `/admin/acts/${made.actId}`)
})

test('setup: an act with a shared key term and a case law with a principle (API)', async ({ request }) => {
  const token = await superToken(request)
  const act = (await call(request, token, 'POST', '/admin/acts', {
    title: `F5b Glossary Act ${STAMP}`,
    shortCode: `F5B${STAMP}`.toUpperCase().slice(0, 50),
  })) as { id: string }
  made.actId = act.id
  const first = (await call(request, token, 'POST', `/admin/acts/${act.id}/sections`, section('1', 'First meaning.'))) as {
    id: string
  }
  made.firstSectionId = first.id
  await call(request, token, 'POST', `/admin/acts/${act.id}/sections`, section('2', 'Second meaning.'))

  const caseLaw = (await call(request, token, 'POST', '/admin/caselaws', {
    title: `F5b v. Glossary ${STAMP}`,
    importance: 'STANDARD',
  })) as { id: string }
  made.caseLawId = caseLaw.id
  await call(request, token, 'PUT', `/admin/caselaws/${caseLaw.id}/content`, {
    legalPrinciples: [{ title: MAXIM, explanation: 'A principle made by the e2e run.' }],
  })

  const response = await request.post(`${API}/auth/register`, {
    data: { email: SOLO_EMAIL, password: PASSWORD, fullName: 'Glossary Student' },
  })
  expect(response.ok(), `register: ${response.status()}`).toBe(true)
})

test('SUPERADMIN: a term used in two sections appears once and opens the first', async ({ page }) => {
  await superadminSignIn(page)
  await page.goto('/acts')
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: 'Vocab' }).click()
  await expect(page).toHaveURL(/\/vocab$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Vocab' })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search terms' }).fill(STAMP)
  await expect(page).toHaveURL(new RegExp(`q=${STAMP}`))
  await expect(page.getByRole('status').filter({ hasText: `1 term matching '${STAMP}'` })).toBeVisible()
  await expect(page.getByText(TERM, { exact: true })).toHaveCount(1)
  await expect(page.getByText('First meaning.')).toBeVisible()
  await expect(page.getByText('Second meaning.')).toHaveCount(0)

  await page.getByRole('button', { name: 'Z', exact: true }).click()
  await expect(page).toHaveURL(/letter=Z/)
  await expect(page.getByText(TERM, { exact: true })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('link', { name: /· s\. 1$/ }).click()
  await expect(page).toHaveURL(new RegExp(`/sections/${made.firstSectionId}$`))
})

test('S_STUDENT: Study hub → Vocab, then Maxims → the case law', async ({ page }) => {
  await signInWithEmail(page, SOLO_EMAIL, PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('link', { name: /Legal terms/ }).click()
  await expect(page).toHaveURL(/\/vocab$/)
  await expect(page.getByRole('navigation', { name: 'Library' })).toHaveCount(0)

  await page.getByRole('navigation', { name: 'Glossary' }).getByRole('link', { name: 'Maxims' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Maxims' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search maxims' }).fill(STAMP)
  await expect(page.getByText(MAXIM, { exact: true })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('link', { name: `F5b v. Glossary ${STAMP}` }).click()
  await expect(page).toHaveURL(new RegExp(`/caselaws/${made.caseLawId}$`))
})
