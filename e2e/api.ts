import { expect, type APIRequestContext } from '@playwright/test'

/** Backend calls the golden paths use to set up state their own screens don't cover. */
export const API = process.env.E2E_API_URL ?? 'http://localhost:8080/api/v1'

/** A one-page PDF that PDFBox accepts (the xref offsets are computed). */
export function pdf(label: string): Buffer {
  const stream = `BT /F1 18 Tf 72 720 Td (${label}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

export async function login(request: APIRequestContext, data: Record<string, string>): Promise<string | null> {
  const response = await request.post(`${API}/auth/login`, { data })
  return response.ok() ? ((await response.json()) as { accessToken: string }).accessToken : null
}

/** Signs in and does the forced password change when due; returns a token. */
export async function loginAndSettle(request: APIRequestContext, data: Record<string, string>, next: string): Promise<string> {
  const response = await request.post(`${API}/auth/login`, { data })
  expect(response.ok(), `login ${JSON.stringify({ ...data, password: '…' })}`).toBe(true)
  const body = (await response.json()) as { accessToken: string; mustChangePassword: boolean }
  if (!body.mustChangePassword) return body.accessToken
  const changed = await request.post(`${API}/auth/change-password`, {
    headers: { Authorization: `Bearer ${body.accessToken}` },
    data: { currentPassword: data.password, newPassword: next },
  })
  expect(changed.ok()).toBe(true)
  return ((await changed.json()) as { accessToken: string }).accessToken
}
