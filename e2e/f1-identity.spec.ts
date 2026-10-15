/**
 * F1 golden path (plan F1 "Done when", UI spec F1). Against a live backend on Phase 1:
 * the seeded SUPERADMIN is forced to change its password, adds a college and a C_ADMIN, the
 * C_ADMIN is forced to change theirs, the SUPERADMIN adds an act and a section, edits the section,
 * imports a sections batch with 3 bad rows, links a section to a case law, and the reader shows
 * the changes. Ends by deactivating the college, after which the C_ADMIN can't sign in.
 *
 * This changes the seeded SUPERADMIN's password to `SUPERADMIN.newPassword` (later runs sign in with
 * it). Restore the seed state to re-run the forced-change part (see the progress file).
 * Desktop only: one run per suite is enough, and the flow is stateful.
 */
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  changePassword,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  logOut,
  signInWithEmail as emailSignIn,
  superadminSignIn,
} from './support'

const STAMP = Date.now().toString(36).toUpperCase()
const COLLEGE_CODE = `E2E${STAMP}`.slice(0, 20)
const ACT_CODE = `E2E${STAMP}`.slice(0, 20)
const ADMIN_EMAIL = `e2e.cadmin.${STAMP.toLowerCase()}@example.com`
const ADMIN_NEW_PASSWORD = 'college-admin-pass-1'

test.describe.configure({ mode: 'serial' })
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'stateful flow: desktop only')

let temporaryPassword = ''
let actId = ''

test('super admin: forced change, then the hub and role nav', async ({ page }) => {
  await superadminSignIn(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Primary' }).first()
  await expect(nav.getByRole('link')).toHaveText(['Colleges', 'Content', 'Audit', 'Library'])
  for (const card of ['Colleges', 'Content', 'Audit log']) {
    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(`^${card}`) })).toBeVisible()
  }
  await expectNoAxeViolations(page)
})

test('super admin adds a college and its admin; the password is shown once', async ({ page }) => {
  await superadminSignIn(page)
  await page.goto('/admin/colleges')
  await expect(page.getByRole('heading', { level: 1, name: 'Colleges' })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'Add college' }).first().click()
  const addCollege = page.getByRole('dialog', { name: 'Add college' })
  await addCollege.getByLabel(/College code/).fill(COLLEGE_CODE.toLowerCase())
  await expect(addCollege.getByLabel(/College code/)).toHaveValue(COLLEGE_CODE)
  await addCollege.getByLabel(/College name/).fill(`E2E College ${STAMP}`)
  await addCollege.getByRole('button', { name: 'Add college' }).click()

  await expect(page.getByRole('heading', { level: 1, name: `E2E College ${STAMP}` })).toBeVisible()
  await expect(page.getByText('College added. Next, add a college admin.')).toBeVisible()
  await expect(page.getByText('This college has no admin yet.')).toBeVisible()
  await expectNoAxeViolations(page)
  await expectNoHorizontalScroll(page)

  // The same code again is a 409 on the code field.
  await page.goto('/admin/colleges')
  await page.getByRole('button', { name: 'Add college' }).first().click()
  const again = page.getByRole('dialog', { name: 'Add college' })
  await again.getByLabel(/College code/).fill(COLLEGE_CODE)
  await again.getByLabel(/College name/).fill('Duplicate')
  await again.getByRole('button', { name: 'Add college' }).click()
  await expect(again.getByText('Another college already uses this code.')).toBeVisible()
  await again.getByRole('button', { name: 'Cancel' }).click()

  await page.getByLabel('Search').fill(COLLEGE_CODE)
  await expect(page).toHaveURL(new RegExp(`q=${COLLEGE_CODE}`))
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('cell', { name: 'None' })).toBeVisible()
  await page.getByRole('link', { name: `E2E College ${STAMP}` }).click()

  await page.getByRole('button', { name: 'Add admin' }).first().click()
  const addAdmin = page.getByRole('dialog', { name: 'Add admin' })
  await addAdmin.getByLabel(/Full name/).fill('E2E College Admin')
  await addAdmin.getByRole('textbox', { name: /Email/ }).fill(ADMIN_EMAIL)
  await addAdmin.getByRole('button', { name: 'Generate' }).click()
  await addAdmin.getByRole('button', { name: 'Add admin' }).click()

  const shared = page.getByRole('dialog', { name: 'Admin added' })
  await expect(shared.getByText(/The password won.t be shown again./)).toBeVisible()
  temporaryPassword = (await shared.locator('dt:has-text("Temporary password") + dd').textContent()) ?? ''
  expect(temporaryPassword).toHaveLength(12)
  await expectNoAxeViolations(page)
  await shared.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText('E2E College Admin')).toBeVisible()
  await expect(page.getByText('Must change password')).toBeVisible()
  await expect(page.locator('dt:has-text("Admins") + dd')).toHaveText('1')
})

test('the college admin is forced to change the password, then lands on /college', async ({ page }) => {
  await emailSignIn(page, ADMIN_EMAIL, temporaryPassword)
  await expect(page).toHaveURL(/\/change-password$/)
  await changePassword(page, temporaryPassword, ADMIN_NEW_PASSWORD)
  await expect(page).toHaveURL(/\/college$/)
  await expect(page.getByRole('heading', { level: 1, name: `E2E College ${STAMP}` })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Primary' }).first()
  await expect(nav.getByRole('link')).toHaveText(['Users', 'Subjects', 'Audit', 'Library'])
  await expectNoAxeViolations(page)

  // Own college only; no college filter.
  await page.goto('/college/audit')
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
  await expect(page.getByLabel('College')).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Password changed' }).first()).toBeVisible()
  await expectNoAxeViolations(page)

  await page.goto('/admin/colleges')
  await expect(page).toHaveURL(/\/college$/)

  await page.goto('/profile')
  await expect(page.locator('dt:has-text("Role") + dd')).toHaveText('College admin')
  await expect(page.locator('dt:has-text("College") + dd')).toHaveText(`E2E College ${STAMP} (${COLLEGE_CODE})`)
  await logOut(page)
})

test('college login: one generic message for bad credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'College' }).click()
  await page.getByLabel('College code').fill('nosuchcollege')
  await expect(page.getByLabel('College code')).toHaveValue('NOSUCHCOLLEGE')
  await page.getByLabel('Roll no. or employee ID').fill('21BAL042')
  await page.getByLabel('Password', { exact: true }).fill('whatever-1')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Incorrect college code, ID or password.')).toBeVisible()
  await expect(page.getByText(/Don.t have your login details\? Ask your college administrator\./)).toBeVisible()
  await expectNoAxeViolations(page)

  // The tab is remembered; credentials are not.
  await page.reload()
  await expect(page.getByRole('tab', { name: 'College' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('College code')).toHaveValue('')
})

test('super admin adds an act and a section, edits the section, and the reader shows it', async ({ page }) => {
  await superadminSignIn(page)
  await page.goto('/admin/acts')
  await expect(page.getByRole('navigation', { name: 'Content' })).toBeVisible()
  await page.getByRole('button', { name: 'Add act' }).first().click()
  const addAct = page.getByRole('dialog', { name: 'Add act' })
  await addAct.getByLabel(/Title/).fill(`The E2E Act ${STAMP}`)
  await addAct.getByLabel(/Short code/).fill(ACT_CODE)
  await addAct.getByRole('button', { name: 'Add act' }).click()
  await expect(page.getByText('Act added.')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('link', { name: `The E2E Act ${STAMP}` }).click()
  actId = page.url().split('/').pop() ?? ''
  await expect(page.getByText('This act has no sections yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Add section' }).first().click()
  const addSection = page.getByRole('dialog', { name: 'Add section' })
  await addSection.getByLabel(/Section number/).fill('1')
  await addSection.getByLabel(/^Title/).fill('Short title')
  await addSection.getByLabel(/Section text/).fill('This Act may be called the E2E Act.')
  await addSection.getByRole('button', { name: 'Add section' }).click()

  await expect(page).toHaveURL(/\/admin\/sections\//)
  await expect(page.getByText('Section added. Add its study content below.')).toBeVisible()
  await expectNoAxeViolations(page)
  const sectionUrl = page.url()

  await page.getByLabel('Plain-language summary').fill(`Names the E2E Act ${STAMP}.`)
  const illustrations = page.getByRole('region', { name: /^Illustrations \(/ })
  await illustrations.getByRole('button', { name: '+ Add illustration' }).click()
  await illustrations.getByLabel(/^Text/).fill('A cites the Act by this name.')
  await illustrations.getByLabel('Written by Lexly (hypothetical)').check()

  // A required field left empty: client validation, error summary, nothing sent.
  const terms = page.getByRole('region', { name: /^Key legal terms/ })
  await terms.getByRole('button', { name: '+ Add term' }).click()
  await page.getByRole('button', { name: 'Save section' }).click()
  await expect(page.getByText('2 problems stopped the save:')).toBeVisible()
  await terms.getByLabel(/^Term/).fill('Short title')
  await terms.getByLabel(/^Definition/).fill('The name by which an Act is cited.')
  await page.getByRole('button', { name: 'Save section' }).click()
  await expect(page.getByText('Section saved.')).toBeVisible()
  await expect(page.getByText('All changes saved')).toBeVisible()

  // Reload: what was saved is what loads (load → save round trip).
  await page.goto(sectionUrl)
  await expect(page.getByLabel('Plain-language summary')).toHaveValue(`Names the E2E Act ${STAMP}.`)
  await expect(page.getByRole('button', { name: 'Save section' })).toBeDisabled()

  await page.getByRole('link', { name: 'View as reader' }).click()
  await expect(page).toHaveURL(/\/sections\//)
  await expect(page.getByText(`Names the E2E Act ${STAMP}.`)).toBeVisible()
  await expect(page.getByText('A cites the Act by this name.')).toBeVisible()
})

test('super admin imports a sections batch with 3 bad rows', async ({ page }) => {
  await superadminSignIn(page)
  await page.goto('/admin/import?kind=sections')
  await expect(page.getByRole('heading', { level: 1, name: 'Import content' })).toBeVisible()
  await expect(page.getByText('Up to 100 sections of one act per batch.')).toBeVisible()

  // Client check first: wrong top-level key.
  await page.getByLabel('JSON').fill(JSON.stringify({ acts: [] }))
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByText('For sections, the JSON needs a top-level "sections" list.')).toBeVisible()

  const batch = {
    actShortCode: ACT_CODE,
    sections: [
      { sectionNumber: '2', title: 'Definitions', bodyText: 'In this Act, unless the context otherwise requires…' },
      { sectionNumber: '3', title: 'Application', bodyText: 'This Act applies to every E2E run.' },
      { sectionNumber: '1', title: 'Duplicate of an existing section', bodyText: 'Again.' },
      { sectionNumber: '4', title: 'No body', bodyText: '' },
      { sectionNumber: '2', title: 'Duplicate in batch', bodyText: 'Twice.' },
    ],
  }
  await page.getByLabel('JSON').fill(JSON.stringify(batch, null, 2))
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByText('2 created · 3 rejected · 0 failed, out of 5.')).toBeVisible()
  // Rejected + Failed are shown first.
  await expect(page.getByRole('button', { name: /^Rejected \(3\)/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('row')).toHaveCount(4)
  await expectNoAxeViolations(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download rejected rows' }).click(),
  ])
  const rejected = JSON.parse(await readFile((await download.path()) ?? '', 'utf8'))
  expect(rejected.actShortCode).toBe(ACT_CODE)
  expect(rejected.sections.map((s: { title: string }) => s.title)).toEqual([
    'Duplicate of an existing section',
    'No body',
    'Duplicate in batch',
  ])

  await page.getByRole('button', { name: /^All \(5\)/ }).click()
  await expect(page.getByRole('row')).toHaveCount(6)

  // The reader lists the act's sections in natural order, imported ones included.
  await page.goto(`/acts/${actId}`)
  await expect(page.getByText('Definitions')).toBeVisible()
  await expect(page.getByText('Application')).toBeVisible()
})

test('super admin links a section to a case law and unlinks it', async ({ page }) => {
  await superadminSignIn(page)
  await page.goto('/admin/caselaws/new')
  await page.getByLabel(/Case name/).fill(`E2E v. Linking ${STAMP}`)
  await page.getByLabel('Citation').fill(`E2E ${STAMP}`)
  await page.getByRole('button', { name: 'Create case law' }).click()
  await expect(page).toHaveURL(/\/content$/)
  const caseLawId = page.url().split('/').at(-2)
  await page.goto(`/admin/caselaws/${caseLawId}`)

  await expect(page.getByText('No sections are linked to this case law.')).toBeVisible()
  await page.getByRole('button', { name: 'Link sections' }).click()
  const picker = page.getByRole('dialog', { name: 'Link sections' })
  await picker.getByLabel('Act').selectOption({ label: `The E2E Act ${STAMP} (${ACT_CODE})` })
  await picker.getByLabel('Filter by number or title').fill('short')
  await picker.getByRole('button', { name: 'Link section 1' }).click()
  await expect(picker.getByRole('button', { name: 'Section 1 linked' })).toBeDisabled()
  await expectNoAxeViolations(page)
  await picker.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText(`${ACT_CODE} · Section 1 — Short title`)).toBeVisible()
  await page.getByRole('button', { name: 'Unlink section 1' }).click()
  await expect(page.getByText('Section 1 unlinked.')).toBeVisible()
  await expect(page.getByText('No sections are linked to this case law.')).toBeVisible()
})

test('audit log shows the run; deactivating the college blocks its admin', async ({ page }) => {
  await superadminSignIn(page)
  await page.goto('/admin/audit?action=COLLEGE_CREATED')
  await expect(page.getByRole('cell', { name: COLLEGE_CODE }).first()).toBeVisible()
  await page.goto('/admin/audit?action=CONTENT_IMPORT')
  await expect(page.getByRole('button', { name: /Sections: 2 created, 3 rejected, 0 failed of 5/ }).first()).toBeVisible()
  await page.getByRole('button', { name: /Sections: 2 created, 3 rejected, 0 failed of 5/ }).first().click()
  await expect(page.locator('dt:has-text("Rejected") + dd').first()).toHaveText('3')
  await expectNoAxeViolations(page)

  await page.goto('/admin/colleges')
  await page.getByLabel('Search').fill(COLLEGE_CODE)
  await page.getByRole('link', { name: `E2E College ${STAMP}` }).click()
  await page.getByRole('button', { name: 'Deactivate' }).click()
  const confirm = page.getByRole('dialog', { name: `Deactivate E2E College ${STAMP}?` })
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Deactivate' }).click()
  await expect(page.getByText(`E2E College ${STAMP} deactivated.`)).toBeVisible()
  await expect(page.getByText(/This college is inactive\. Its users can.t sign in\./)).toBeVisible()
  await logOut(page)

  await emailSignIn(page, ADMIN_EMAIL, ADMIN_NEW_PASSWORD)
  await expect(page.getByText("Your college's account is inactive. Contact your administrator.")).toBeVisible()
})
