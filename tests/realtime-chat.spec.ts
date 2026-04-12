import { test, expect, chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

async function loginAs(page: import('@playwright/test').Page, nickname: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="text"]', nickname)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/chat`, { timeout: 15000 })
  // Realtime 연결 대기
  await page.waitForTimeout(2000)
}

test('실시간 채팅: minuk → test 메시지 수신', async () => {
  const browser = await chromium.launch({ headless: true })

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    // 두 유저 동시 로그인
    await Promise.all([
      loginAs(pageA, 'minuk'),
      loginAs(pageB, 'test'),
    ])

    const testMessage = `playwright-test-${Date.now()}`

    // pageA(minuk)에서 메시지 전송
    const input = pageA.locator('input[placeholder="메시지 입력..."]')
    await input.fill(testMessage)
    await input.press('Enter')

    // pageB(test)에서 메시지 수신 확인 (최대 10초)
    await expect(pageB.locator(`text=${testMessage}`)).toBeVisible({ timeout: 10000 })

    console.log('✅ minuk → test: 실시간 메시지 수신 성공')
  } finally {
    await browser.close()
  }
})

test('실시간 채팅: test → minuk 메시지 수신 (역방향)', async () => {
  const browser = await chromium.launch({ headless: true })

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    await Promise.all([
      loginAs(pageA, 'minuk'),
      loginAs(pageB, 'test'),
    ])

    const testMessage = `playwright-reverse-${Date.now()}`

    // pageB(test)에서 메시지 전송
    const input = pageB.locator('input[placeholder="메시지 입력..."]')
    await input.fill(testMessage)
    await input.press('Enter')

    // pageA(minuk)에서 메시지 수신 확인
    await expect(pageA.locator(`text=${testMessage}`)).toBeVisible({ timeout: 10000 })

    console.log('✅ test → minuk: 실시간 메시지 수신 성공')
  } finally {
    await browser.close()
  }
})

test('실시간 채팅: 양방향 연속 메시지', async () => {
  const browser = await chromium.launch({ headless: true })

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    await Promise.all([
      loginAs(pageA, 'minuk'),
      loginAs(pageB, 'test'),
    ])

    const ts = Date.now()
    const msgA1 = `A1-${ts}`
    const msgB1 = `B1-${ts}`
    const msgA2 = `A2-${ts}`

    // A → B
    await pageA.locator('input[placeholder="메시지 입력..."]').fill(msgA1)
    await pageA.locator('input[placeholder="메시지 입력..."]').press('Enter')
    await expect(pageB.locator(`text=${msgA1}`)).toBeVisible({ timeout: 10000 })

    // B → A
    await pageB.locator('input[placeholder="메시지 입력..."]').fill(msgB1)
    await pageB.locator('input[placeholder="메시지 입력..."]').press('Enter')
    await expect(pageA.locator(`text=${msgB1}`)).toBeVisible({ timeout: 10000 })

    // A → B 다시
    await pageA.locator('input[placeholder="메시지 입력..."]').fill(msgA2)
    await pageA.locator('input[placeholder="메시지 입력..."]').press('Enter')
    await expect(pageB.locator(`text=${msgA2}`)).toBeVisible({ timeout: 10000 })

    console.log('✅ 양방향 연속 메시지: 성공')
  } finally {
    await browser.close()
  }
})
