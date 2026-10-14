import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Dev seed from the backend's .env.example (TDD §4.4); override for other environments. */
export const SUPERADMIN = {
  email: process.env.E2E_SUPERADMIN_EMAIL ?? 'superadmin@lexly.local',
  password: process.env.E2E_SUPERADMIN_PASSWORD ?? 'lexly-superadmin-dev',
}

/** Fails on WCAG 2.x A/AA violations on the current screen (plan §3.9: one axe scan per screen). */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary, 'axe violations').toEqual([])
}

export async function signInWithEmail(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow, 'page scrolls sideways').toBe(false)
}
