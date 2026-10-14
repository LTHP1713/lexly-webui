import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Dev seed from the backend's .env.example (TDD §4.4); override for other environments. The F1
 * suite changes the seeded password to `newPassword` on its first run (the forced change).
 */
export const SUPERADMIN = {
  email: process.env.E2E_SUPERADMIN_EMAIL ?? 'superadmin@lexly.local',
  password: process.env.E2E_SUPERADMIN_PASSWORD ?? 'lexly-superadmin-dev',
  newPassword: process.env.E2E_SUPERADMIN_NEW_PASSWORD ?? 'lexly-superadmin-e2e-1',
}

/** Fails on WCAG 2.x A/AA violations on the current screen (plan §3.9: one axe scan per screen). */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary, 'axe violations').toEqual([])
}

/** The Email tab of the login screen (UI spec F1.1). */
export async function signInWithEmail(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Email' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

/** Fills the forced change form and waits for the success toast. */
export async function changePassword(page: Page, current: string, next: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible()
  await page.getByLabel('Current password').fill(current)
  await page.getByLabel('New password', { exact: true }).fill(next)
  await page.getByLabel('Confirm new password').fill(next)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Password updated.')).toBeVisible()
}

/**
 * Signs the seeded SUPERADMIN in, whatever state it is in: with the seed password (doing the
 * forced change to `newPassword` if it is still due), or with `newPassword` after an earlier run.
 * Ends on `/admin`.
 */
export async function superadminSignIn(page: Page) {
  await signInWithEmail(page, SUPERADMIN.email, SUPERADMIN.password)
  const outcome = await Promise.race([
    page.waitForURL(/\/change-password$/).then(() => 'forced' as const),
    page.waitForURL(/\/admin$/).then(() => 'home' as const),
    page.getByText('Incorrect email or password.').waitFor().then(() => 'changed' as const),
  ])
  if (outcome === 'forced') await changePassword(page, SUPERADMIN.password, SUPERADMIN.newPassword)
  if (outcome === 'changed') await signInWithEmail(page, SUPERADMIN.email, SUPERADMIN.newPassword)
  await expect(page).toHaveURL(/\/admin$/)
}

export async function logOut(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow, 'page scrolls sideways').toBe(false)
}
