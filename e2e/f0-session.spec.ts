/**
 * F0 golden paths (plan F0 "Done when"; UI spec F0.3, F1.2). Changes no passwords: the seeded
 * SUPERADMIN is only taken as far as the forced change form. Registers one new S_STUDENT per run.
 */
import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, expectNoHorizontalScroll, signInWithEmail, SUPERADMIN } from './support'

test('signed out: unknown URL shows NotFound, protected URL goes to login', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.goto('/admin/caselaws')
  await expect(page).toHaveURL(/\/login$/)
  await expectNoAxeViolations(page)
})

test('seeded super admin is held on the forced password change', async ({ page }) => {
  await signInWithEmail(page, SUPERADMIN.email, SUPERADMIN.password)
  const stillForced = await Promise.race([
    page.waitForURL(/\/change-password$/).then(() => true),
    page.getByText('Incorrect email or password.').waitFor().then(() => false),
  ])
  // The F1 suite performs the real change; after it, this check needs the seed state restored.
  test.skip(!stillForced, 'the seeded SUPERADMIN has already changed its password (restore the seed to run this)')
  await expect(page).toHaveURL(/\/change-password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
  await expectNoAxeViolations(page)
  await expectNoHorizontalScroll(page)

  for (const url of ['/admin/caselaws', '/acts', '/profile', '/']) {
    await page.goto(url)
    await expect(page).toHaveURL(/\/change-password$/)
  }

  // A wrong current password is a 400 on the field; nothing changes on the server.
  await page.getByLabel('Current password').fill('definitely-wrong')
  await page.getByLabel('New password', { exact: true }).fill('another-pass-1')
  await page.getByLabel('Confirm new password').fill('another-pass-1')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Your current password is incorrect.')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('a new solo student gets the student nav and is kept out of admin', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Full name').fill('E2E Student')
  await page.getByRole('textbox', { name: 'Email' }).fill(`e2e.student.${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('student-pass-1')
  await page.getByRole('button', { name: /create account/i }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Bare Acts', 'Practice', 'Profile'])
  await expectNoAxeViolations(page)
  await expectNoHorizontalScroll(page)

  await page.goto('/admin/caselaws')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/practice')
  await expect(page.getByText('Solo practice is coming soon')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.goto('/profile')
  await page.getByRole('link', { name: 'Change password' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cancel' })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
})
