/**
 * F1 work-area screens at phone width (UI spec §0.1: admin screens are desktop-first but must
 * work on a phone): cards instead of tables, no sideways scroll, and an axe scan per screen.
 * Read-only apart from the sign-in, so it can run after the F1 golden path.
 */
import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, expectNoHorizontalScroll, superadminSignIn } from './support'

test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'phone layout checks')

test('super admin work areas fit a phone', async ({ page }) => {
  await superadminSignIn(page)
  await expect(page.getByRole('navigation', { name: 'Primary' }).last()).toBeVisible()

  for (const path of ['/admin', '/admin/colleges', '/admin/acts', '/admin/import', '/admin/audit', '/admin/caselaws']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await expectNoAxeViolations(page)
  }

  // A college and an act detail, if the run before left any.
  await page.goto('/admin/colleges')
  const college = page.getByRole('list', { name: 'Colleges' }).getByRole('link').first()
  if (await college.count()) {
    await college.click()
    await expect(page.getByRole('tab', { name: 'Admins' })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectNoAxeViolations(page)
  }
  await page.goto('/admin/acts')
  const act = page.getByRole('list', { name: 'Acts' }).getByRole('link').first()
  if (await act.count()) {
    await act.click()
    await expect(page.getByRole('heading', { level: 2, name: 'Sections' })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectNoAxeViolations(page)
  }
})
