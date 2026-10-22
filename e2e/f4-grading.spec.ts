/**
 * F4 golden path (plan F4 "Done when", UI spec F4). Against a live backend on Phase 4: a professor
 * grades question by question from the submissions grid, and the student sees each mark as soon
 * as it is approved, with the unpublished one still "Awaiting evaluation". Ends with a phone pass.
 *
 * The college, users, subject, a published assessment and the submitted answers are set up
 * through the API (F2 and F3 cover those screens). Grading doesn't wait for the due date, so the
 * assessment stays open. Desktop only: the flow is stateful.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API, login, loginAndSettle, pdf } from './api'
import { SUPERADMIN, expectNoAxeViolations, expectNoHorizontalScroll, logOut } from './support'

const STAMP = Date.now().toString(36).toLowerCase()
const COLLEGE_CODE = `F4${STAMP}`.toUpperCase().slice(0, 20)
const ADMIN_EMAIL = `f4.cadmin.${STAMP}@example.com`
const PASSWORD = 'my-own-pass-123'
const TITLE = `Grading run ${STAMP}`

test.describe.configure({ mode: 'serial' })
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'stateful flow: desktop only')

async function call(request: APIRequestContext, token: string, method: string, path: string, data?: unknown) {
  const response = await request.fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true)
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

const resultCard = (page: Page, position: number) =>
  page.locator('article').filter({ has: page.getByRole('heading', { level: 2, name: `Question ${position}`, exact: true }) })

test('setup: college, users, a published 2-question assessment and submitted answers (API)', async ({ request }) => {
  const superToken =
    (await login(request, { email: SUPERADMIN.email, password: SUPERADMIN.newPassword })) ??
    (await loginAndSettle(request, { email: SUPERADMIN.email, password: SUPERADMIN.password }, SUPERADMIN.newPassword))
  const college = (await call(request, superToken, 'POST', '/superadmin/colleges', { code: COLLEGE_CODE, name: `F4 College ${STAMP}` })) as {
    id: string
  }
  await call(request, superToken, 'POST', `/superadmin/colleges/${college.id}/admins`, {
    fullName: 'F4 College Admin',
    email: ADMIN_EMAIL,
    temporaryPassword: 'temporary-pass-1',
  })
  const admin = await loginAndSettle(request, { email: ADMIN_EMAIL, password: 'temporary-pass-1' }, PASSWORD)
  const professor = (await call(request, admin, 'POST', '/college/users', {
    role: 'C_PROFESSOR',
    fullName: 'Dr. Kavya Menon',
    email: `menon.${STAMP}@example.com`,
    loginId: 'EMP1',
  })) as { id: string }
  for (const [name, roll] of [
    ['Asha Rao', 'R001'],
    ['Vikram Singh', 'R002'],
  ]) {
    await call(request, admin, 'POST', '/college/users', {
      role: 'C_STUDENT',
      fullName: name,
      email: `${roll.toLowerCase()}.${STAMP}@example.com`,
      loginId: roll,
    })
  }
  const subject = (await call(request, admin, 'POST', '/college/subjects', { code: 'CON-101', name: 'Constitutional Law I', description: null })) as {
    id: string
  }
  await call(request, admin, 'PUT', `/college/subjects/${subject.id}/professors`, { professorIds: [professor.id] })

  const tokens: Record<string, string> = {}
  for (const loginId of ['EMP1', 'R001', 'R002']) {
    tokens[loginId] = await loginAndSettle(request, { collegeCode: COLLEGE_CODE, loginId, password: loginId }, PASSWORD)
  }

  const draft = (await call(request, tokens.EMP1, 'POST', '/professor/assessments', {
    subjectId: subject.id,
    title: TITLE,
    instructions: null,
    dueAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    questions: [
      { id: null, text: 'Discuss Article 21.', maxMarks: 10, wordLimit: 500 },
      { id: null, text: 'Define a writ.', maxMarks: 5, wordLimit: 200 },
    ],
  })) as { id: string; questions: { id: string }[] }
  await call(request, tokens.EMP1, 'POST', `/professor/assessments/${draft.id}/publish`)

  // Asha answers both questions, Vikram only the first.
  const answers: [string, number[]][] = [
    ['R001', [0, 1]],
    ['R002', [0]],
  ]
  for (const [student, indexes] of answers) {
    for (const i of indexes) {
      const path = `/student/questions/${draft.questions[i].id}/answer`
      const upload = await request.put(`${API}${path}`, {
        headers: { Authorization: `Bearer ${tokens[student]}` },
        multipart: { file: { name: `q${i + 1}.pdf`, mimeType: 'application/pdf', buffer: pdf(`${student} answer ${i + 1}`) } },
      })
      expect(upload.ok(), `upload ${student} q${i + 1}: ${await upload.text()}`).toBe(true)
      await call(request, tokens[student], 'POST', `${path}/submit`)
    }
  }
})

test('professor grades question 1 from the grid', async ({ page }) => {
  await collegeSignIn(page, 'EMP1')
  await expect(page).toHaveURL(/\/professor$/)
  await page.goto('/professor/assessments')
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: TITLE }) })
  await expect(row.getByRole('cell', { name: '3 of 4' })).toBeVisible()
  // Submitted · To grade · Published
  await expect(row.getByRole('cell').nth(5)).toHaveText('3')
  await expect(row.getByRole('cell').nth(6)).toHaveText('0')

  await row.getByRole('link', { name: TITLE }).click()
  await expect(page.locator('dt:has-text("To grade") + dd')).toHaveText('3')
  const grid = page.getByRole('table', { name: 'Submissions' })
  await expect(grid.getByRole('link', { name: /: To grade$/ })).toHaveCount(3)
  await expectNoAxeViolations(page)

  await grid.getByRole('link', { name: 'Question 1, Asha Rao: To grade' }).click()
  await expect(page).toHaveURL(/\/professor\/answers\/[^/?]+\?order=byStudent$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Asha Rao' })).toBeVisible()
  await expect(page.getByTitle('PDF: q1.pdf')).toBeVisible()
  await expect(page.getByRole('button', { name: '← Previous' })).toBeDisabled()

  // Approve is blocked without feedback; a draft can be saved half-done.
  await page.getByLabel('Marks (out of 10)').fill('8')
  await page.getByRole('button', { name: 'Approve & publish…' }).click()
  await expect(page.getByText('Write feedback for the student.')).toBeVisible()
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText("Draft saved. The student can't see it yet.")).toBeVisible()
  await expect(page.getByText('Grade history (1)')).toBeVisible()

  // Out-of-range marks are caught before anything is sent.
  await page.getByLabel('Marks (out of 10)').fill('11')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Enter marks from 0 to 10, in whole or half marks.')).toBeVisible()

  await page.getByLabel('Marks (out of 10)').fill('8')
  await page.getByLabel(/^Feedback for the student/).fill('Clear structure.\nCite Maneka Gandhi.')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Approve & publish…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Publish the grade for question 1?' })
  await expect(dialog.getByText(/Asha Rao sees 8 \/ 10 and your feedback immediately/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Publish grade' }).click()
  await expect(page.getByText('Grade published.')).toBeVisible()
  await expect(page.getByText('8 / 10', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Marks (out of 10)')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Next ungraded →' })).toBeFocused()
  await expectNoAxeViolations(page)
  await logOut(page)
})

test('the student sees question 1 at once, and question 2 awaiting', async ({ page }) => {
  await collegeSignIn(page, 'R001')
  await expect(page).toHaveURL(/\/student$/)
  await page.goto('/student/assessments')
  const link = page.getByRole('link', { name: new RegExp(TITLE) })
  await expect(link.getByText(/1 result published/)).toBeVisible()
  await link.click()
  await page.getByRole('link', { name: 'View results' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: `Results: ${TITLE}` })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Marks, of published questions' }).getByText('8 / 10')).toBeVisible()
  await expect(resultCard(page, 1).getByText(/Clear structure\./)).toBeVisible()
  await expect(resultCard(page, 2).getByText('Awaiting evaluation')).toBeVisible()
  await expectNoAxeViolations(page)
  await logOut(page)
})

test('professor continues with next ungraded, and the counts follow', async ({ page }) => {
  await collegeSignIn(page, 'EMP1')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await page.goto('/professor/assessments')
  await page.getByRole('link', { name: TITLE }).click()
  await page.getByRole('table', { name: 'Submissions' }).getByRole('link', { name: 'Question 1, Asha Rao: Published, 8 of 10' }).click()
  await page.getByRole('link', { name: 'Next ungraded →' }).click()
  await expect(page.getByText('Question 2 · ' + TITLE)).toBeVisible()
  await page.getByLabel('Marks (out of 5)').fill('4.5')
  await page.getByLabel(/^Feedback for the student/).fill('Precise.')
  await page.getByRole('button', { name: 'Approve & publish…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish grade' }).click()
  await expect(page.getByText('Grade published.')).toBeVisible()

  await page.getByRole('link', { name: 'Next ungraded →' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vikram Singh' })).toBeVisible()
  await page.getByRole('link', { name: TITLE }).click()
  await expect(page.locator('dt:has-text("To grade") + dd')).toHaveText('1')
  await expect(page.locator('dt:has-text("Published") + dd')).toHaveText('2')
  await page.getByLabel('Status').selectOption('PUBLISHED')
  await expect(page.getByText('1 student')).toBeVisible()
  await logOut(page)
})

test('the results work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await collegeSignIn(page, 'R001')
  await page.getByRole('link', { name: new RegExp(TITLE) }).click()
  await page.getByRole('link', { name: 'View results' }).first().click()
  await expect(page.getByRole('region', { name: 'Marks, of published questions' }).getByText('12.5 / 15')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectNoAxeViolations(page)
  await logOut(page)
})

test('the answer review works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await collegeSignIn(page, 'EMP1')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await page.goto('/professor/assessments')
  await page.getByRole('link', { name: TITLE }).click()
  await page.getByRole('link', { name: 'Question 1, Vikram Singh: To grade' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vikram Singh' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectNoAxeViolations(page)
  await logOut(page)
})
