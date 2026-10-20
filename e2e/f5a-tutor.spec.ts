/**
 * F5a golden path (plan F5a "Done when", UI spec F5a). Needs the backend on Phase 5a **and**
 * `lexly-ai-service` running with a Gemini key; skips with a message otherwise. SUPERADMIN
 * re-indexes and waits for it to succeed; then a fresh C_STUDENT asks a question, gets a cited
 * answer, opens its library source and asks a follow-up in the same chat.
 *
 * Asking uses real quota, so the student is created fresh each run. The question must be one the
 * indexed library can answer; override it with `E2E_TUTOR_QUESTION`. Desktop only: stateful.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API, login, loginAndSettle } from './api'
import { SUPERADMIN, expectNoAxeViolations, logOut, superadminSignIn } from './support'

const AI_URL = process.env.E2E_AI_URL ?? 'http://localhost:8000'
const QUESTION = process.env.E2E_TUTOR_QUESTION ?? 'Who is competent to contract under the Indian Contract Act?'
const FOLLOW_UP = 'Can you explain that in simpler words?'
const STAMP = Date.now().toString(36).toLowerCase()
const COLLEGE_CODE = `F5A${STAMP}`.toUpperCase().slice(0, 20)
const ADMIN_EMAIL = `f5a.cadmin.${STAMP}@example.com`
const PASSWORD = 'my-own-pass-123'

test.describe.configure({ mode: 'serial' })
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'stateful flow: desktop only')

async function call(request: APIRequestContext, token: string, method: string, path: string, data?: unknown) {
  const response = await request.fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true)
  return response.json()
}

async function superToken(request: APIRequestContext) {
  return (
    (await login(request, { email: SUPERADMIN.email, password: SUPERADMIN.newPassword })) ??
    (await loginAndSettle(request, { email: SUPERADMIN.email, password: SUPERADMIN.password }, SUPERADMIN.newPassword))
  )
}

async function collegeSignIn(page: Page, loginId: string) {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'College' }).click()
  await page.getByLabel('College code').fill(COLLEGE_CODE)
  await page.getByLabel('Roll no. or employee ID').fill(loginId)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

test.beforeAll(async ({ request }) => {
  const health = await request.get(`${AI_URL}/health`, { timeout: 5000 }).catch(() => null)
  test.skip(!health?.ok(), `lexly-ai-service isn't reachable at ${AI_URL}/health; start it to run the tutor golden path`)
  const token = await superToken(request)
  const quota = await request.get(`${API}/tutor/quota`, { headers: { Authorization: `Bearer ${token}` } })
  test.skip(quota.status() === 404, 'The backend has no tutor endpoints; run lexly-backend on feature/phase5a (or main after the merge)')
})

test('setup: a college with one student (API)', async ({ request }) => {
  const token = await superToken(request)
  const college = (await call(request, token, 'POST', '/superadmin/colleges', { code: COLLEGE_CODE, name: `F5a College ${STAMP}` })) as {
    id: string
  }
  await call(request, token, 'POST', `/superadmin/colleges/${college.id}/admins`, {
    fullName: 'F5a College Admin',
    email: ADMIN_EMAIL,
    temporaryPassword: 'temporary-pass-1',
  })
  const admin = await loginAndSettle(request, { email: ADMIN_EMAIL, password: 'temporary-pass-1' }, PASSWORD)
  await call(request, admin, 'POST', '/college/users', {
    role: 'C_STUDENT',
    fullName: 'Asha Rao',
    email: `r001.${STAMP}@example.com`,
    loginId: 'R001',
  })
  await loginAndSettle(request, { collegeCode: COLLEGE_CODE, loginId: 'R001', password: 'R001' }, PASSWORD)
})

test('SUPERADMIN re-indexes and watches the run finish', async ({ page }) => {
  test.setTimeout(15 * 60_000)
  await superadminSignIn(page)
  await page.getByRole('link', { name: /^Tutor/ }).first().click()
  await expect(page).toHaveURL(/\/admin\/tutor$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tutor admin' })).toBeVisible()

  const reindex = page.getByRole('button', { name: 'Re-index…' }).first()
  // A run left over from elsewhere has to finish first.
  await expect(reindex).toBeEnabled({ timeout: 10 * 60_000 })
  await reindex.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Re-index' }).click()
  const latest = page.getByRole('region', { name: 'Latest run' })
  await expect(latest.getByText('Running')).toBeVisible()
  await expect(latest.getByText(/^(Succeeded|Failed)$/)).toBeVisible({ timeout: 10 * 60_000 })
  await expect(latest.getByText('Succeeded')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('tab', { name: 'Spend' }).click()
  await expect(page).toHaveURL(/tab=spend/)
  await expect(page.getByRole('img', { name: /^Daily AI cost from/ })).toBeVisible()
  await expectNoAxeViolations(page)
  await logOut(page)
})

test('a student asks, opens a cited section and asks a follow-up in the same chat', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  await collegeSignIn(page, 'R001')
  await expect(page).toHaveURL(/\/student$/)
  await page.getByRole('navigation', { name: 'Primary' }).first().getByRole('link', { name: 'Tutor' }).click()
  await expect(page).toHaveURL(/\/tutor$/)
  await expect(page.getByText('10 of 10 questions left today', { exact: false })).toBeVisible()
  await expectNoAxeViolations(page)

  const composer = page.getByRole('textbox', { name: 'Your question' })
  await composer.fill(QUESTION)
  await composer.press('Enter')
  await expect(page.getByText('Answering… this can take up to a minute').first()).toBeVisible()
  const sources = page.getByRole('region', { name: 'Sources' }).first()
  await expect(sources, 'expected a cited answer; set E2E_TUTOR_QUESTION to something the library covers').toBeVisible({
    timeout: 90_000,
  })
  await expect(page).toHaveURL(/\/tutor\/[^/]+$/)
  const chatUrl = page.url()
  expect(chatUrl).not.toContain('contract')
  await expect(page.getByText('9 of 10 questions left today', { exact: false })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Your chats' }).getByRole('link')).toHaveCount(1)
  await expectNoAxeViolations(page)

  // A library source opens its reader page.
  const libraryLink = sources.getByRole('link').first()
  const href = await libraryLink.getAttribute('href')
  expect(href).toMatch(/^\/(sections|caselaws)\/[^/]+$/)
  await libraryLink.click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(chatUrl)

  await composer.fill(FOLLOW_UP)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(FOLLOW_UP)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Conversation' }).getByRole('listitem')).toHaveCount(4, { timeout: 90_000 })
  await expect(page).toHaveURL(chatUrl)
  await expect(page.getByText('8 of 10 questions left today', { exact: false })).toBeVisible()
})
