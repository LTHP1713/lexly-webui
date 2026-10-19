/**
 * F3 golden path (plan F3 "Done when", UI spec F3). Against a live backend on Phase 3: a professor
 * writes a 10-question assessment and publishes it; a student uploads, replaces and submits 7
 * answers and leaves an 8th uploaded but unsubmitted; after the due date the student sees 3 "Not
 * attempted", and once the close job has run the professor's grid matches. Ends with a phone pass.
 *
 * The college, its users and the subject are set up through the API (F2 covers those screens).
 * The due date is a few minutes ahead, so the run waits for it. Desktop only: the flow is stateful.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API, login, loginAndSettle, pdf } from './api'
import { SUPERADMIN, expectNoAxeViolations, expectNoHorizontalScroll, logOut } from './support'

const STAMP = Date.now().toString(36).toLowerCase()
const COLLEGE_CODE = `F3${STAMP}`.toUpperCase().slice(0, 20)
const ADMIN_EMAIL = `f3.cadmin.${STAMP}@example.com`
const PASSWORD = 'my-own-pass-123'
const TITLE = `Moot problem ${STAMP}`
const QUESTIONS = 10

test.describe.configure({ mode: 'serial' })
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'stateful flow: desktop only')

let dueAt = new Date()

async function post(request: APIRequestContext, token: string, path: string, data: unknown) {
  const response = await request.fetch(`${API}${path}`, {
    method: path.endsWith('/professors') ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBe(true)
  return response.json()
}

async function collegeSignIn(page: Page, loginId: string) {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'College' }).click()
  await page.getByLabel('College code').fill(COLLEGE_CODE)
  await page.getByLabel('Roll no. or employee ID').fill(loginId)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

const card = (page: Page, position: number) =>
  page.locator('article').filter({ has: page.getByRole('heading', { level: 2, name: `Question ${position}`, exact: true }) })

test('setup: college, admin, a professor, two students and a subject (API)', async ({ request }) => {
  const superToken =
    (await login(request, { email: SUPERADMIN.email, password: SUPERADMIN.newPassword })) ??
    (await loginAndSettle(request, { email: SUPERADMIN.email, password: SUPERADMIN.password }, SUPERADMIN.newPassword))
  const college = (await post(request, superToken, '/superadmin/colleges', { code: COLLEGE_CODE, name: `F3 College ${STAMP}` })) as {
    id: string
  }
  await post(request, superToken, `/superadmin/colleges/${college.id}/admins`, {
    fullName: 'F3 College Admin',
    email: ADMIN_EMAIL,
    temporaryPassword: 'temporary-pass-1',
  })
  const admin = await loginAndSettle(request, { email: ADMIN_EMAIL, password: 'temporary-pass-1' }, PASSWORD)

  const professor = (await post(request, admin, '/college/users', {
    role: 'C_PROFESSOR',
    fullName: 'Dr. Kavya Menon',
    email: `menon.${STAMP}@example.com`,
    loginId: 'EMP1',
  })) as { id: string }
  for (const [name, roll] of [
    ['Asha Rao', 'R001'],
    ['Vikram Singh', 'R002'],
  ]) {
    await post(request, admin, '/college/users', {
      role: 'C_STUDENT',
      fullName: name,
      email: `${roll.toLowerCase()}.${STAMP}@example.com`,
      loginId: roll,
    })
  }
  const subject = (await post(request, admin, '/college/subjects', {
    code: 'CON-101',
    name: 'Constitutional Law I',
    description: null,
  })) as { id: string }
  await post(request, admin, `/college/subjects/${subject.id}/professors`, { professorIds: [professor.id] })

  // College accounts start with their login ID as the password.
  for (const loginId of ['EMP1', 'R001', 'R002']) {
    await loginAndSettle(request, { collegeCode: COLLEGE_CODE, loginId, password: loginId }, PASSWORD)
  }
})

test('professor writes a 10-question draft, sees the checklist, and publishes it', async ({ page }) => {
  await collegeSignIn(page, 'EMP1')
  await expect(page).toHaveURL(/\/professor$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Assessments' })).toBeVisible()
  await expect(page.getByText(/No assessments yet\. Create one for a subject you teach/)).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('link', { name: 'New assessment' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'New assessment' })).toBeVisible()
  await expect(page.getByLabel(/^Subject/)).toHaveValue(/.+/)
  await page.getByLabel(/^Title/).fill(TITLE)
  await page.getByLabel('Instructions for students').fill('Answer every question.\nCite the cases you rely on.')

  // Publishing with gaps is blocked by the checklist, with no request.
  await page.getByRole('button', { name: 'Publish…' }).click()
  await expect(page.getByRole('link', { name: 'Due date: Set a due date.' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Save a half-written draft: the URL moves to /edit.
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved.')).toBeVisible()
  await expect(page).toHaveURL(/\/professor\/assessments\/[^/]+\/edit$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Edit draft' })).toBeVisible()

  for (let i = 1; i < QUESTIONS; i++) await page.getByRole('button', { name: '+ Add question' }).click()
  for (let i = 0; i < QUESTIONS; i++) {
    const row = page.locator('fieldset').filter({ has: page.locator('legend', { hasText: new RegExp(`^Question ${i + 1}$`) }) })
    await row.getByLabel(/^Question/).fill(`Question ${i + 1}: discuss the leading case.`)
    await row.getByLabel(/^Max marks/).fill(i % 2 ? '5' : '7.5')
    await row.getByLabel(/^Word limit/).fill('400')
  }
  await expect(page.getByText('Total: 62.5 marks')).toBeVisible()

  // A due date at least three whole minutes ahead (the field has minute precision).
  dueAt = new Date(Math.ceil((Date.now() + 3 * 60_000) / 60_000) * 60_000)
  const local = new Date(dueAt.getTime() - dueAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  await page.getByLabel(/^Due date and time/).fill(local)
  await expect(page.getByText('Ready to publish.')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'Publish…' }).click()
  const dialog = page.getByRole('dialog', { name: `Publish “${TITLE}”?` })
  await expect(dialog.getByText('10 questions · 62.5 marks.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Assessment published.')).toBeVisible()
  await expect(page).toHaveURL(/\/professor\/assessments\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Submissions' }).getByRole('rowheader')).toHaveCount(2)
  await expectNoAxeViolations(page)
  await logOut(page)
})

test('student uploads, replaces and submits 7 answers, and leaves one unsubmitted', async ({ page }) => {
  // It ends by waiting for the due date, a few minutes ahead.
  test.setTimeout(6 * 60_000)
  await collegeSignIn(page, 'R001')
  await expect(page).toHaveURL(/\/student$/)
  const todo = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'To do' }) })
  await expect(todo.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible()
  await expect(todo.getByText(/Due soon/)).toBeVisible()
  await expectNoAxeViolations(page)

  await todo.getByRole('link', { name: new RegExp(TITLE) }).click()
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
  await expect(page.getByText(/Upload one PDF per question: at most 5 MB and 10 pages/)).toBeVisible()

  // A non-PDF is refused in the browser.
  await card(page, 1).locator('input[type=file]').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('hello') })
  await expect(card(page, 1).getByText("This file isn't a readable PDF.")).toBeVisible()

  for (let q = 1; q <= 8; q++) {
    const answer = card(page, q)
    await answer.locator('input[type=file]').setInputFiles({ name: `q${q}.pdf`, mimeType: 'application/pdf', buffer: pdf(`Answer ${q}`) })
    await expect(answer.getByText('Uploaded, not submitted')).toBeVisible()
    await expect(answer.getByText(new RegExp(`^q${q}\\.pdf`)).first()).toBeVisible()
  }
  await expectNoAxeViolations(page)

  // Replace question 1's upload.
  await card(page, 1).locator('input[type=file]').setInputFiles({ name: 'q1-v2.pdf', mimeType: 'application/pdf', buffer: pdf('Answer 1, again') })
  await expect(card(page, 1).getByText(/^q1-v2\.pdf/).first()).toBeVisible()

  // View your own file.
  await card(page, 1).getByRole('button', { name: 'View' }).click()
  const viewer = page.getByRole('dialog', { name: 'q1-v2.pdf' })
  await expect(viewer.locator('iframe')).toBeVisible()
  await viewer.getByRole('button', { name: 'Close' }).click()

  for (let q = 1; q <= 7; q++) {
    await card(page, q).getByRole('button', { name: 'Submit answer' }).click()
    const confirm = page.getByRole('dialog', { name: `Submit your answer to question ${q}?` })
    await confirm.getByRole('button', { name: 'Submit answer' }).click()
    await expect(card(page, q).getByText('Submitted', { exact: true })).toBeVisible()
  }
  await expect(page.getByText('7 of 10 answers submitted')).toBeVisible()
  await expect(card(page, 1).getByRole('button', { name: 'Replace' })).toHaveCount(0)
  expect(Date.now(), 'the answering finished before the due date').toBeLessThan(dueAt.getTime())

  // After the due date the page turns read-only on its own (corrected clock).
  await expect(page.getByText(/Upload one PDF per question/)).toHaveCount(0, { timeout: dueAt.getTime() - Date.now() + 30_000 })
  await expect(page.getByRole('article').getByText('Not attempted', { exact: true })).toHaveCount(3)
  await expect(card(page, 8).getByText(/uploaded but not submitted before the due date|Nothing was submitted/)).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  await expectNoAxeViolations(page)
  await logOut(page)
})

test("after the close job, the professor's grid matches", async ({ page }) => {
  test.setTimeout(4 * 60_000)
  await collegeSignIn(page, 'EMP1')
  await expect(page).toHaveURL(/\/professor$/)
  await page.getByRole('link', { name: TITLE }).click()
  // The close job runs every minute.
  await expect(async () => {
    await page.reload()
    await expect(page.getByRole('main').getByText('Closed', { exact: true }).first()).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 3 * 60_000, intervals: [10_000] })

  await expect(page.locator('dt:has-text("Submitted") + dd')).toHaveText('7 of 20')
  await expect(page.locator('dt:has-text("Not attempted") + dd')).toHaveText('13')
  const grid = page.getByRole('table', { name: 'Submissions' })
  const asha = grid.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Asha Rao/ }) })
  // Each cell is an icon + text, so count cells by their text.
  // Submitted answers show their grade since F4: none is graded here.
  await expect(asha.getByRole('cell').filter({ hasText: /^●To grade$/ })).toHaveCount(7)
  await expect(asha.getByRole('cell').filter({ hasText: /^✕Not attempted$/ })).toHaveCount(3)

  // Filter by status: Not attempted is offered now that it is closed.
  await page.getByLabel('Status').selectOption('NOT_ATTEMPTED')
  await expect(page).toHaveURL(/status=NOT_ATTEMPTED/)
  await page.getByLabel('Search').fill('R001')
  await expect(page.getByText('1 student')).toBeVisible()
  await expect(page).not.toHaveURL(/R001/)
  await expectNoAxeViolations(page)

  // The list agrees.
  await page.goto('/professor')
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: TITLE }) })
  await expect(row.getByRole('cell', { name: '7 of 20' })).toBeVisible()
  await expect(row.getByRole('cell', { name: '13' })).toBeVisible()
  await logOut(page)
})

test('the student screens work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await collegeSignIn(page, 'R001')
  await expect(page).toHaveURL(/\/student$/)
  const closed = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Closed' }) })
  await expect(closed.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectNoAxeViolations(page)
  await closed.getByRole('link', { name: new RegExp(TITLE) }).click()
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectNoAxeViolations(page)
  await logOut(page)
})
