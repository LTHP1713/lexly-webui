/**
 * F0.7: the cookie-session checks from the 2026-10-09 progress entry, re-run against the live
 * backend (they first ran against a mock). Each test registers its own S_STUDENT, so no seeded
 * account is touched.
 */
import { expect, request, test, type Page } from '@playwright/test'

const API = process.env.E2E_API_URL ?? 'http://localhost:8080/api/v1'
const ORIGIN = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const PASSWORD = 'student-pass-1'

function newEmail() {
  return `e2e.cookie.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
}

async function register(page: Page, email = newEmail()) {
  await page.goto('/register')
  await page.getByLabel('Full name').fill('Cookie Check')
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  return email
}

async function expectSignedIn(page: Page) {
  await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
}

test('the refresh cookie is HttpOnly, scoped to /api/v1/auth, and survives a reload', async ({ page, context }) => {
  await register(page)
  const cookie = (await context.cookies(`${API}/auth/refresh`)).find((c) => c.name === 'lexly_refresh_token')
  expect(cookie, 'refresh cookie').toBeDefined()
  expect(cookie).toMatchObject({ httpOnly: true, path: '/api/v1/auth', sameSite: 'Lax' })
  expect(await page.evaluate(() => document.cookie)).not.toContain('lexly_refresh_token')
  // Nothing auth-related in Web Storage (plan §9.1).
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(storage).not.toMatch(/token|eyJ/i)

  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expectSignedIn(page)
})

test('two tabs reloading together both stay signed in (Web Lock)', async ({ page, context }) => {
  await register(page)
  const second = await context.newPage()
  await second.goto('/acts')
  await expectSignedIn(second)

  for (let round = 0; round < 3; round++) {
    await Promise.all([page.reload(), second.reload()])
    await expectSignedIn(page)
    await expectSignedIn(second)
  }
})

test('navigating away while the refresh is in flight does not sign the user out (G10)', async ({ page }) => {
  await register(page)
  for (let round = 0; round < 3; round++) {
    // Start a page load (which starts the bootstrap refresh), then leave before it settles.
    await page.goto('/acts', { waitUntil: 'commit' })
    await page.goto('/profile', { waitUntil: 'commit' })
    await page.goto('/dashboard')
    await expectSignedIn(page)
  }
})

test('logout clears the cookie; the next load is signed out with no "session ended" banner', async ({ page, context }) => {
  await register(page)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  const cookie = (await context.cookies(`${API}/auth/refresh`)).find((c) => c.name === 'lexly_refresh_token')
  expect(cookie?.value ?? '').toBe('')
  expect(await page.evaluate(() => Number(localStorage.getItem('lexly.httpCacheBypassUntil')) > Date.now())).toBe(true)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Your session has ended')).toHaveCount(0)
})

test('on the wire: refresh 400 without a cookie, 401 for a rotated one; cache and CORS headers', async () => {
  const api = await request.newContext()
  const email = newEmail()
  const registered = await api.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, fullName: 'Cookie Check' },
  })
  expect(registered.status()).toBe(201)
  const { refreshToken, accessToken } = await registered.json()

  const bare = await request.newContext()
  expect((await bare.post(`${API}/auth/refresh`)).status()).toBe(400)

  // Each refresh rotates the token, so replaying the old one fails.
  const first = await bare.post(`${API}/auth/refresh`, { data: { refreshToken } })
  expect(first.status()).toBe(200)
  const replay = await bare.post(`${API}/auth/refresh`, { data: { refreshToken } })
  expect(replay.status()).toBe(401)
  expect((await replay.json()).error).toBe('UNAUTHORIZED')

  const acts = await api.get(`${API}/acts`, { headers: { Authorization: `Bearer ${accessToken}` } })
  expect(acts.status()).toBe(200)
  expect(acts.headers()['cache-control']).toMatch(/private/)
  expect(acts.headers()['cache-control']).toMatch(/max-age=300/)
  expect(acts.headers()['etag']).toBeTruthy()
  const me = await api.get(`${API}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
  expect(me.headers()['cache-control']).toMatch(/no-store/)

  const preflight = await bare.fetch(`${API}/auth/refresh`, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' },
  })
  expect(preflight.headers()['access-control-allow-origin']).toBe(ORIGIN)
  expect(preflight.headers()['access-control-allow-credentials']).toBe('true')

  const logout = await bare.post(`${API}/auth/logout`)
  expect(logout.status()).toBe(204)
  await api.dispose()
  await bare.dispose()
})
