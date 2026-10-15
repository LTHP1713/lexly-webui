/**
 * F2 golden path (plan F2 "Done when", UI spec F2). Against a live backend on Phase 2: the
 * SUPERADMIN adds a college and its C_ADMIN; the C_ADMIN imports professors, then a students file
 * with a duplicate roll no, a bad email and a solo account to convert, reads the per-row results,
 * manages users (add with a duplicate ID, reset, remove with the typed login ID), creates subjects
 * and maps professors. An imported student then signs in with college code + roll no and sees the
 * subject; a professor sees it in the assessment list's filter. Ends with the audit summary and a phone pass.
 *
 * Desktop only (the phone pass resizes the window itself): the flow is stateful.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  changePassword,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  logOut,
  signInWithEmail,
  superadminSignIn,
} from './support'

const API = process.env.E2E_API_URL ?? 'http://localhost:8080/api/v1'
const STAMP = Date.now().toString(36).toLowerCase()
const COLLEGE_CODE = `F2${STAMP}`.toUpperCase().slice(0, 20)
const COLLEGE_NAME = `F2 College ${STAMP}`
const ADMIN_EMAIL = `f2.cadmin.${STAMP}@example.com`
const ADMIN_PASSWORD = 'college-admin-pass-2'
const SOLO_EMAIL = `f2.solo.${STAMP}@example.com`
const NEW_PASSWORD = 'my-own-pass-123'

test.describe.configure({ mode: 'serial' })
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'stateful flow: desktop only')

let temporaryPassword = ''

async function adminSignIn(page: Page) {
  await signInWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/college$/)
}

async function collegeSignIn(page: Page, loginId: string, password: string) {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'College' }).click()
  await page.getByLabel('College code').fill(COLLEGE_CODE)
  await page.getByLabel('Roll no. or employee ID').fill(loginId)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

async function importFile(page: Page, name: string, text: string) {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })
  await expect(page.getByText(name)).toBeVisible()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
}

test('super admin adds the college and its admin', async ({ page, request }) => {
  // A personal (S_STUDENT) account that the student import will convert.
  const registered = await request.post(`${API}/auth/register`, {
    data: { email: SOLO_EMAIL, password: 'solo-pass-1234', fullName: 'Solo Learner' },
  })
  expect(registered.status()).toBe(201)

  await superadminSignIn(page)
  await page.goto('/admin/colleges')
  await page.getByRole('button', { name: 'Add college' }).first().click()
  const addCollege = page.getByRole('dialog', { name: 'Add college' })
  await addCollege.getByLabel(/College code/).fill(COLLEGE_CODE)
  await addCollege.getByLabel(/College name/).fill(COLLEGE_NAME)
  await addCollege.getByRole('button', { name: 'Add college' }).click()
  await expect(page.getByRole('heading', { level: 1, name: COLLEGE_NAME })).toBeVisible()

  await page.getByRole('button', { name: 'Add admin' }).first().click()
  const addAdmin = page.getByRole('dialog', { name: 'Add admin' })
  await addAdmin.getByLabel(/Full name/).fill('F2 College Admin')
  await addAdmin.getByRole('textbox', { name: /Email/ }).fill(ADMIN_EMAIL)
  await addAdmin.getByRole('button', { name: 'Generate' }).click()
  await addAdmin.getByRole('button', { name: 'Add admin' }).click()
  const shared = page.getByRole('dialog', { name: 'Admin added' })
  temporaryPassword = (await shared.locator('dt:has-text("Temporary password") + dd').textContent()) ?? ''
  expect(temporaryPassword).toHaveLength(12)
  await shared.getByRole('button', { name: 'Done' }).click()
  await logOut(page)
})

test('college admin: hub and nav, then a professors import', async ({ page }) => {
  await signInWithEmail(page, ADMIN_EMAIL, temporaryPassword)
  await changePassword(page, temporaryPassword, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/college$/)
  await expect(page.getByRole('heading', { level: 1, name: COLLEGE_NAME })).toBeVisible()
  await expect(page.getByText(COLLEGE_CODE, { exact: true })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Primary' }).first()
  await expect(nav.getByRole('link')).toHaveText(['Users', 'Subjects', 'Audit', 'Library'])
  await expectNoAxeViolations(page)

  await page.getByRole('main').getByRole('link', { name: /^Users/ }).click()
  await expect(page).toHaveURL(/\/college\/users$/)
  await expect(page.getByText('No students yet. Add them one at a time, or import a CSV or Excel file.')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.goto('/college/users/import?kind=professors')
  await expect(page.getByRole('heading', { level: 1, name: 'Import users' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Professors' })).toBeChecked()
  // The templates are served from /templates/.
  const template = await page.request.get('/templates/professors.csv')
  expect((await template.text()).split(/\r?\n/)[0]).toBe('full_name,email,employee_id')
  await expectNoAxeViolations(page)

  await importFile(
    page,
    'professors.csv',
    `full_name,email,employee_id\nDr. Kavya Menon,menon.${STAMP}@example.com,EMP1\nProf. Lata Iyer,iyer.${STAMP}@example.com,EMP2\n`,
  )
  await expect(page.getByText('2 created · 0 rejected · 0 failed, out of 2.')).toBeVisible()
  await expect(page.getByText('2 users imported.')).toBeVisible()
})

test('college admin imports students: duplicate, bad email and a conversion, row by row', async ({ page }) => {
  await adminSignIn(page)
  await page.goto('/college/users/import')

  // A wrong header is a whole-file error, shown under the file.
  await importFile(page, 'wrong.csv', 'name,email,roll_no\nA,a@b.in,1\n')
  await expect(page.getByText(/^This file can.t be imported: /)).toBeVisible()
  await page.getByRole('button', { name: 'Remove wrong.csv' }).click()

  await importFile(
    page,
    'students.csv',
    [
      'full_name,email,roll_no',
      `Asha Rao,asha.${STAMP}@example.com,R001`,
      `Dup Rao,dup.${STAMP}@example.com,R001`,
      'Bad Email,not-an-email,R003',
      `Solo Learner,${SOLO_EMAIL},R004`,
      `Vikram Singh,vikram.${STAMP}@example.com,R005`,
    ].join('\n'),
  )
  await expect(page.getByText('2 created · 1 converted · 2 rejected · 0 failed, out of 5.')).toBeVisible()
  await expect(page.getByText(/Fix these rows in your file and import it again/)).toBeVisible()

  // Rejected rows first, numbered as in the spreadsheet (the header is row 1).
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Roll no' })).toBeVisible()
  const duplicate = table.getByRole('row').filter({ hasText: 'roll_no: duplicate of row 2' })
  await expect(duplicate.getByRole('cell').first()).toHaveText('3')
  const badEmail = table.getByRole('row').filter({ hasText: 'R003' })
  await expect(badEmail.getByRole('cell').first()).toHaveText('4')
  await expect(badEmail).toContainText('email:')
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: /^All/ }).click()
  const converted = table.getByRole('row').filter({ hasText: 'Converted' })
  await expect(converted.getByRole('cell').first()).toHaveText('5')
  await expect(converted).toContainText('Their personal Lexly account was converted to a student account here.')
  await converted.getByRole('link', { name: 'Open R004' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Solo Learner' })).toBeVisible()
  await expect(page.getByText('Must change password')).toBeVisible()
  await expectNoAxeViolations(page)
})

test('college admin manages users: duplicate ID, reset, remove with the typed login ID, Not Found', async ({ page }) => {
  await adminSignIn(page)
  await page.goto('/college/users')
  await expect(page.getByText('3 students')).toBeVisible()
  await expectNoAxeViolations(page)

  // Add with a used roll no → the field error.
  await page.getByRole('button', { name: 'Add student' }).first().click()
  const add = page.getByRole('dialog', { name: 'Add student' })
  await expect(add.getByText(`They sign in with ${COLLEGE_CODE} and this ID.`, { exact: false })).toBeVisible()
  await add.getByLabel(/Full name/).fill('Another Asha')
  await add.getByRole('textbox', { name: /Email/ }).fill(`another.${STAMP}@example.com`)
  await add.getByLabel(/Roll no/).fill('R001')
  await add.getByRole('button', { name: 'Add student' }).click()
  await expect(add.getByText('Another student or professor at your college already uses this ID.')).toBeVisible()
  await add.getByLabel(/Roll no/).fill('R006')
  await add.getByRole('button', { name: 'Add student' }).click()
  await expect(page.getByText('Another Asha added. Their first password is their roll no.')).toBeVisible()
  await expect(page.getByText('4 students')).toBeVisible()

  // Search, then reset and remove from the row menu.
  await page.getByLabel('Search').fill('vikram')
  await expect(page).toHaveURL(/q=vikram/)
  await expect(page.getByRole('row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Actions for Vikram Singh' }).click()
  await page.getByRole('button', { name: 'Reset password' }).click()
  const reset = page.getByRole('dialog', { name: 'Reset password for Vikram Singh?' })
  await expect(reset).toContainText('The password becomes their roll no (R005)')
  await reset.getByRole('button', { name: 'Reset password' }).click()
  await expect(page.getByText('Password reset for Vikram Singh.')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Vikram Singh' }).click()
  await page.getByRole('button', { name: 'Remove' }).click()
  const remove = page.getByRole('dialog', { name: 'Remove Vikram Singh?' })
  const confirm = remove.getByRole('button', { name: 'Remove student' })
  await remove.getByLabel(/to confirm/).fill('r005')
  await expect(confirm).toBeDisabled()
  await remove.getByLabel(/to confirm/).fill('R005')
  await expectNoAxeViolations(page)
  await confirm.click()
  await expect(page.getByText('Vikram Singh removed.')).toBeVisible()
  await expect(page.getByText('No students match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByText('3 students')).toBeVisible()

  await page.getByRole('tab', { name: 'Professors' }).click()
  await expect(page).toHaveURL(/role=professors/)
  await expect(page.getByText('2 professors')).toBeVisible()
  await page.getByRole('link', { name: 'Dr. Kavya Menon' }).click()
  await expect(page.getByText('Not assigned to any subject yet.')).toBeVisible()
  await expectNoAxeViolations(page)

  // Another college's (or a made-up) id is Not Found, never "no access".
  await page.goto('/college/users/00000000-0000-0000-0000-000000000000')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('college admin creates subjects and maps professors', async ({ page }) => {
  await adminSignIn(page)
  await page.goto('/college/subjects')
  await expect(page.getByText('No subjects yet.', { exact: false })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'Add subject' }).first().click()
  const add = page.getByRole('dialog', { name: 'Add subject' })
  await add.getByLabel(/Subject code/).fill('con-101')
  await expect(add.getByLabel(/Subject code/)).toHaveValue('CON-101')
  await add.getByLabel(/Subject name/).fill('Constitutional Law I')
  await add.getByLabel(/Description/).fill('Fundamental rights.\nDirective principles.')
  await add.getByRole('button', { name: 'Add subject' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Constitutional Law I' })).toBeVisible()
  await expect(page.getByText('Subject added. Next, assign its professors.')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'Assign professors' }).click()
  const picker = page.getByRole('dialog', { name: 'Professors for Constitutional Law I' })
  await picker.getByRole('checkbox', { name: /Dr. Kavya Menon/ }).check()
  await picker.getByLabel('Search professors').fill('iyer')
  await expect(picker.getByRole('checkbox', { name: /Dr. Kavya Menon/ })).toHaveCount(0)
  await picker.getByRole('checkbox', { name: /Prof. Lata Iyer/ }).check()
  await expect(picker.getByText('2 selected')).toBeVisible()
  await expectNoAxeViolations(page)
  await picker.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Professors updated.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Prof. Lata Iyer' })).toBeVisible()

  // A second subject, and a duplicate code; then delete the second one.
  await page.goto('/college/subjects')
  await expect(page.getByRole('cell', { name: 'Dr. Kavya Menon, Prof. Lata Iyer' })).toBeVisible()
  await page.getByRole('button', { name: 'Add subject' }).click()
  const second = page.getByRole('dialog', { name: 'Add subject' })
  await second.getByLabel(/Subject code/).fill('CON-101')
  await second.getByLabel(/Subject name/).fill('Duplicate')
  await second.getByRole('button', { name: 'Add subject' }).click()
  await expect(second.getByText('Another subject at your college already uses this code.')).toBeVisible()
  await second.getByLabel(/Subject code/).fill('TOR-101')
  await second.getByLabel(/Subject name/).fill('Law of Torts')
  await second.getByRole('button', { name: 'Add subject' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Law of Torts' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog', { name: 'Delete Law of Torts?' }).getByRole('button', { name: 'Delete subject' }).click()
  await expect(page).toHaveURL(/\/college\/subjects$/)
  await expect(page.getByText('Law of Torts deleted.')).toBeVisible()
  await expect(page.getByText('1 subject')).toBeVisible()

  // The professor's detail now lists the subject.
  await page.goto('/college/users?role=professors')
  await page.getByRole('link', { name: 'Dr. Kavya Menon' }).click()
  await expect(page.getByRole('link', { name: 'Constitutional Law I' })).toBeVisible()
  await logOut(page)
})

test('an imported student signs in with college code + roll no and sees the subject', async ({ page }) => {
  await collegeSignIn(page, 'R001', 'R001')
  await changePassword(page, 'R001', NEW_PASSWORD)
  await expect(page).toHaveURL(/\/student$/)
  // Since F3 the subject shows in the assessment list's Subject filter.
  await expect(page.getByLabel('Subject').getByRole('option', { name: /CON-101 · Constitutional Law I/ })).toBeAttached()
  await expectNoAxeViolations(page)
  await logOut(page)

  // The converted solo account now signs in with the roll no as well.
  await collegeSignIn(page, 'R004', 'R004')
  await expect(page).toHaveURL(/\/change-password$/)
})

test('a professor sees their subject in the assessment filter', async ({ page }) => {
  await collegeSignIn(page, 'EMP1', 'EMP1')
  await changePassword(page, 'EMP1', NEW_PASSWORD)
  await expect(page).toHaveURL(/\/professor$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Assessments' })).toBeVisible()
  await expect(page.getByLabel('Subject').getByRole('option', { name: /CON-101 · Constitutional Law I/ })).toBeAttached()
  await expectNoAxeViolations(page)
  await logOut(page)
})

test('the audit log summarises the import; the college pages work on a phone', async ({ page }) => {
  await adminSignIn(page)
  await page.goto('/college/audit')
  await expect(page.getByRole('cell', { name: 'Students: 2 created, 1 converted, 2 rejected, 0 failed of 5' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'CON-101 · 2 professors' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/college', '/college/users', '/college/users/import', '/college/subjects']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await expectNoAxeViolations(page)
  }
})
