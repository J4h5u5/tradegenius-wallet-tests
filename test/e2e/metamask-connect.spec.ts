import { expect } from '@playwright/test'
import { testWithSynpress } from '@synthetixio/synpress'
import { metaMaskFixtures } from '@synthetixio/synpress/playwright'
import metamaskSetup from '../wallet-setup/metamask/wallet.setup.mjs'
import { AssetPage } from '../page-objects/asset.page.ts'

async function unlockOnPage(page: import('@playwright/test').Page, walletPassword: string) {
  const openWalletButton = page.getByRole('button', { name: /open wallet/i }).first()
  if (await openWalletButton.isVisible({ timeout: 1_500 }).catch(() => false)) {
    const openWalletEnabled = await openWalletButton.isEnabled({ timeout: 1_000 }).catch(() => false)
    if (openWalletEnabled) {
      await page.bringToFront().catch(() => {})
      await openWalletButton.click({ timeout: 5_000 })
      await page.waitForTimeout(800)
    } else {
      // Onboarding completion tab can show disabled "Open wallet"; it is not actionable for connect flow.
      if (page.url().includes('/home.html#onboarding/completion')) {
        await page.close().catch(() => {})
      }
      return
    }
  }

  const passwordInput = page
    .locator('input[type="password"], input[id*="password" i], input[placeholder*="password" i]')
    .first()
  const isLocked = await passwordInput.isVisible({ timeout: 3_000 }).catch(() => false)

  if (!isLocked) {
    return
  }

  await page.bringToFront().catch(() => {})
  await passwordInput.click({ timeout: 5_000 }).catch(() => {})
  await passwordInput.fill(walletPassword)
  await page.waitForTimeout(250)

  const unlockButton = page.getByRole('button', { name: /unlock/i }).first()
  const unlockTestIdButton = page.locator('[data-testid="unlock-submit"]').first()

  if (await unlockButton.isVisible().catch(() => false)) {
    await unlockButton.click({ timeout: 5_000 })
  } else if (await unlockTestIdButton.isVisible().catch(() => false)) {
    await unlockTestIdButton.click({ timeout: 5_000 })
  } else {
    await page.keyboard.press('Enter').catch(() => {})
  }

  // Give MetaMask a moment to transition away from lock screen.
  await page.waitForTimeout(700)
}

async function ensureMetaMaskUnlocked(
  context: import('@playwright/test').BrowserContext,
  extensionId: string,
  metamaskPage: import('@playwright/test').Page,
  metamask: { unlock: () => Promise<void> }
) {
  const walletPassword = process.env.WALLET_PASSWORD
  if (!walletPassword) {
    throw new Error('Missing WALLET_PASSWORD in .env')
  }

  await Promise.race([
    metamask.unlock().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 4_000))
  ])

  for (let pass = 1; pass <= 4; pass += 1) {
    const extensionPages = context
      .pages()
      .filter((p) => p.url().startsWith(`chrome-extension://${extensionId}/`))
    const pagesToCheck = extensionPages.length > 0 ? extensionPages : [metamaskPage]

    for (const extPage of pagesToCheck) {
      await unlockOnPage(extPage, walletPassword)
    }

    const anyLocked = await Promise.all(
      pagesToCheck.map(async (p) =>
        p.locator('input[type="password"], input[id*="password" i], input[placeholder*="password" i]').first()
          .isVisible({ timeout: 500 })
          .catch(() => false)
      )
    ).then((v) => v.some(Boolean))

    if (!anyLocked) {
      return
    }

    await context.waitForEvent('page', { timeout: 1200 }).catch(() => {})
  }

  throw new Error('MetaMask stayed locked after unlock attempts.')
}

async function confirmViaMetaMaskActionShortcut(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  extensionId: string
) {
  const tryConfirmOnExtPage = async (extPage: import('@playwright/test').Page) => {
    const next = extPage.getByRole('button', { name: /^next$/i }).first()
    const connect = extPage.getByRole('button', { name: /^connect$/i }).first()
    const footerNext = extPage.locator('[data-testid="page-container-footer-next"]').first()

    if (await footerNext.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await extPage.bringToFront().catch(() => {})
      await footerNext.click({ timeout: 8_000 }).catch(() => {})
      await extPage.waitForTimeout(500)
      if (await footerNext.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await footerNext.click({ timeout: 8_000 }).catch(() => {})
      }
      return true
    }

    if (await next.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await extPage.bringToFront().catch(() => {})
      await next.click({ timeout: 8_000 }).catch(() => {})
      await extPage.waitForTimeout(500)
      if (await connect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await connect.click({ timeout: 8_000 }).catch(() => {})
      }
      return true
    }

    if (await connect.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await extPage.bringToFront().catch(() => {})
      await connect.click({ timeout: 8_000 }).catch(() => {})
      return true
    }

    return false
  }

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const waiting = page.getByText(/continue in metamask|connection denied/i).first()
    const waitingVisible = await waiting.isVisible({ timeout: 800 }).catch(() => false)
    if (!waitingVisible) {
      return true
    }

    await page.bringToFront().catch(() => {})
    await page.keyboard.press('Alt+Shift+M').catch(() => {})
    await page.waitForTimeout(900)

    const extensionPages = context.pages().filter((p) => p.url().startsWith(`chrome-extension://${extensionId}/`))
    for (const extPage of extensionPages) {
      if (await tryConfirmOnExtPage(extPage)) {
        await page.bringToFront().catch(() => {})
        await page.waitForTimeout(1_200)
      }
    }

    const tryAgainButton = page.getByRole('button', { name: /try again/i }).first()
    if (await tryAgainButton.isVisible({ timeout: 800 }).catch(() => false)) {
      await tryAgainButton.click({ timeout: 5_000 }).catch(() => {})
    }

    await page.waitForTimeout(1_200)
  }

  return false
}

async function connectMetaMaskWithRetries(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  extensionId: string,
  metamaskPage: import('@playwright/test').Page,
  metamask: { connectToDapp: () => Promise<void>; unlock: () => Promise<void> }
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensureMetaMaskUnlocked(context, extensionId, metamaskPage, metamask)
      await metamask.connectToDapp()
      return
    } catch (error) {
      lastError = error
      const tryAgainButton = page.getByRole('button', { name: /try again/i }).first()
      if (await tryAgainButton.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await tryAgainButton.click({ timeout: 5_000 }).catch(() => {})
      }

      if (error instanceof Error && /Notification page did not appear/i.test(error.message)) {
        const confirmed = await confirmViaMetaMaskActionShortcut(page, context, extensionId)
        if (confirmed) {
          return
        }
      }

      await page.waitForTimeout(1500)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('MetaMask connectToDapp failed after retries.')
}

async function closeExtraMetaMaskTabs(
  context: import('@playwright/test').BrowserContext,
  extensionId: string,
  keepPage: import('@playwright/test').Page
) {
  const onboardingCompletionTabs = context
    .pages()
    .filter((p) => p.url().startsWith(`chrome-extension://${extensionId}/`) && p.url().includes('#onboarding/completion'))

  for (const tab of onboardingCompletionTabs) {
    if (tab !== keepPage) {
      await tab.close().catch(() => {})
    }
  }

  const extraTabs = context
    .pages()
    .filter((p) => p !== keepPage && p.url().startsWith(`chrome-extension://${extensionId}/`))

  for (const tab of extraTabs) {
    await tab.close().catch(() => {})
  }
}

const test = testWithSynpress(metaMaskFixtures(metamaskSetup)).extend({
  page: async ({ context, extensionId, metamask, metamaskPage }, use) => {
    await ensureMetaMaskUnlocked(context, extensionId, metamaskPage, metamask)

    const appUrl = process.env.BASE_URL ?? 'https://dev.tradegenius.com/asset'
    const appOrigin = new URL(appUrl).origin
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: appOrigin
    })

    let appPage = context.pages().find((p) => !p.url().startsWith('chrome-extension://'))
    if (!appPage) {
      appPage = await context.newPage()
    }

    await appPage.goto('/asset', { waitUntil: 'domcontentloaded' })
    await closeExtraMetaMaskTabs(context, extensionId, metamaskPage)
    await use(appPage)
  }
})

test('unlock MetaMask, open /asset, click Sign In', async ({ page, context, extensionId, metamask, metamaskPage }) => {
  const assetPage = new AssetPage(page)

  await page.waitForTimeout(3_000);
  await assetPage.clickSignIn()
  await assetPage.waitCaptchaAndClickConnectWithWallet()
  await assetPage.chooseWallet('MetaMask')
  await assetPage.selectEvmNetworks()
  await connectMetaMaskWithRetries(page, context, extensionId, metamaskPage, metamask)
  await expect(page).toHaveURL(/tradegenius\.com\/asset/i)
})
