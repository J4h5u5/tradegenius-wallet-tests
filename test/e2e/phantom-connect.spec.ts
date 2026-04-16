import { expect } from '@playwright/test'
import { testWithSynpress } from '@synthetixio/synpress'
import { phantomFixtures } from '@synthetixio/synpress/playwright'
import phantomSetup from '../wallet-setup/phantom/wallet.setup.mjs'
import { AssetPage } from '../page-objects/asset.page.ts'

async function completePhantomSignature(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  extensionId: string,
  phantom: { confirmSignature: () => Promise<void> }
) {
  let confirmedCount = 0

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const notificationPage = context
        .pages()
        .find((p) => p.url().startsWith(`chrome-extension://${extensionId}/notification.html`))

      if (notificationPage) {
        await notificationPage.setViewportSize({ width: 1280, height: 900 }).catch(() => {})
        await notificationPage.bringToFront().catch(() => {})
        await notificationPage.waitForTimeout(500)
      }

      await phantom.confirmSignature()
      confirmedCount += 1
      await page.bringToFront().catch(() => {})
      await page.waitForTimeout(900)

      if (confirmedCount >= 2) {
        return
      }
    } catch {
      const tryAgainButton = page.getByRole('button', { name: /try again/i }).first()
      if (await tryAgainButton.isVisible({ timeout: 1_200 }).catch(() => false)) {
        await tryAgainButton.click({ timeout: 5_000 }).catch(() => {})
      }
      await page.waitForTimeout(1200)
    }
  }

  throw new Error(`Phantom signature confirmation failed. Confirmed ${confirmedCount}/2 messages.`)
}

const test = testWithSynpress(phantomFixtures(phantomSetup)).extend({
  page: async ({ context }, use) => {
    const page = await context.newPage()
    await page.goto('/asset')
    await use(page)
    await page.close()
  }
})

test('connect Phantom and verify wallet address', async ({ page, context, extensionId, phantom }) => {
  const assetPage = new AssetPage(page)
  const expectedPhantomEvmAddress = process.env.PHANTOM_ADDRESS ?? ''

  await assetPage.open()
  await assetPage.clickSignIn()
  await assetPage.waitCaptchaAndClickConnectWithWallet()
  await assetPage.chooseWallet('Phantom')
  await assetPage.selectEvmNetworks()
  await phantom.connectToDapp()
  await completePhantomSignature(page, context, extensionId, phantom)
  await assetPage.acceptTosIfShown()
  await assetPage.completePostConnectOnboarding()
  await assetPage.acceptTosIfShown(4_000)
  await assetPage.openAccountTab()
  await assetPage.assertUsernameStartsWithTestUser()
  await assetPage.openWalletsTab()
  await assetPage.assertEvmWalletAddressMatches(expectedPhantomEvmAddress)

  await expect(page).toHaveURL(/tradegenius\.com\/account/i)
})
