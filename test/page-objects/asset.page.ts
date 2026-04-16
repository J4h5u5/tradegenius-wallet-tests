import { expect, type Locator, type Page } from '@playwright/test'

export class AssetPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async open() {
    const baseUrl = process.env.BASE_URL ?? 'https://dev.tradegenius.com/asset'
    await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded' })

    if (await this.isNetworkErrorPage()) {
      await this.page.reload({ waitUntil: 'domcontentloaded' })
    }

    await expect(this.page).toHaveURL(/tradegenius\.com\/asset/i)
    const signInButton = this.page.getByRole('button', { name: /sign in/i }).first()
    await expect(signInButton).toBeVisible({ timeout: 8_000 })
  }

  async clickSignIn() {
    const byRole = this.page.getByRole('button', { name: /^sign in$/i }).first()
    const byTextButton = this.page.locator('button:has-text("Sign In")').first()

    if (await byRole.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await this.humanClick(byRole)
      return
    }

    await this.humanClick(byTextButton)
  }

  async waitCaptchaAndClickConnectWithWallet() {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const walletPickerAlreadyOpen = await this.page
        .locator('w3m-modal')
        .first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false)
      if (walletPickerAlreadyOpen) {
        return
      }

      const authModal = this.page
        .locator('[role="dialog"], [role="generic"]')
        .filter({ hasText: /sign in or create an account/i })
        .first()

      if (!(await authModal.isVisible({ timeout: 4_000 }).catch(() => false))) {
        await this.clickSignIn()
        await expect(authModal).toBeVisible({ timeout: 15_000 })
      }

      const googleButton = authModal.getByRole('button', { name: /continue with google/i }).first()
      const appleButton = authModal.getByRole('button', { name: /continue with apple/i }).first()
      const connectWithWalletButton = authModal.getByRole('button', { name: /connect with wallet/i }).first()
      const completeCaptchaButton = authModal
        .getByRole('button', { name: /complete captcha to connect wallet/i })
        .first()

      const googleVisible = await googleButton.isVisible({ timeout: 1_500 }).catch(() => false)
      const appleVisible = await appleButton.isVisible({ timeout: 1_500 }).catch(() => false)
      const connectVisible = await connectWithWalletButton.isVisible({ timeout: 1_500 }).catch(() => false)
      const completeCaptchaVisible = await completeCaptchaButton.isVisible({ timeout: 1_500 }).catch(() => false)

      // Flaky state: only one auth button (usually captcha-only). Close and reopen Sign In modal.
      const visibleButtonsCount = Number(googleVisible) + Number(appleVisible) + Number(connectVisible) + Number(completeCaptchaVisible)
      if (visibleButtonsCount <= 1) {
        const closeButton = authModal.locator('button:has-text("×"), button[aria-label*="close" i], button').last()
        if (await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await closeButton.click().catch(() => {})
        }
        await this.page.waitForTimeout(1200)
        await this.clickSignIn()
        continue
      }

      // Wait until captcha turns into "Connect with Wallet".
      await expect(completeCaptchaButton).toBeHidden({ timeout: 180_000 }).catch(() => {})
      await expect(connectWithWalletButton).toBeVisible({ timeout: 180_000 })
      await expect(connectWithWalletButton).toBeEnabled({ timeout: 180_000 })

      // Found a strange behavior, sometimes only 1 button with captcha at the modal
      // If only 1 button , clicking it closes modal. As a temp fix i decided to add a close
      // and reopen of the modal. Click only if 3 buttons present at the modal
      // Test is very flaky. Need to fix a bug and refactor.
      //Or other idea is to connect wallet after opening any assets page (there is constant a buttons)

      let hasAllThreeButtons = true
      try {
        await expect.poll(
          async () => {
            const g = await googleButton.isVisible().catch(() => false)
            const a = await appleButton.isVisible().catch(() => false)
            const c = await connectWithWalletButton.isVisible().catch(() => false)
            return g && a && c
          },
          { timeout: 10_000, intervals: [1500, 1800, 2000] }
        ).toBe(true)
      } catch {
        hasAllThreeButtons = false
      }

      if (!hasAllThreeButtons) {
        const closeButton = authModal.locator('button:has-text("×"), button[aria-label*="close" i], button').last()
        if (await closeButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await closeButton.click().catch(() => {})
        }
        await this.page.waitForTimeout(1200)
        await this.clickSignIn()
        continue
      }

      await connectWithWalletButton.scrollIntoViewIfNeeded()
      await connectWithWalletButton.click({ timeout: 6_000 }).catch(async () => {
        await this.humanClick(connectWithWalletButton)
      })

      let walletPickerOpened = true
      try {
        await expect
          .poll(
            async () => {
              const hasW3m = await this.page.locator('w3m-modal').first().isVisible().catch(() => false)
              const hasMetaMaskOption = await this.page.getByText(/metamask/i).first().isVisible().catch(() => false)
              return hasW3m || hasMetaMaskOption
            },
            { timeout: 8_000, intervals: [500, 800, 1000] }
          )
          .toBe(true)
      } catch {
        walletPickerOpened = false
      }

      if (walletPickerOpened) {
        return
      }

      // Click had no effect; reopen auth modal and retry.
      const closeButton = authModal.locator('button:has-text("×"), button[aria-label*="close" i], button').last()
      if (await closeButton.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await closeButton.click().catch(() => {})
      }
      await this.page.waitForTimeout(1200)
      await this.clickSignIn()
      continue
    }

    throw new Error('Could not reach stable auth modal state (Google+Apple+Connect) before clicking Connect with Wallet.')
  }

  async chooseWallet(walletName: 'MetaMask' | 'Phantom') {
    const nameRe = new RegExp(walletName, 'i')
    const walletLower = walletName.toLowerCase()

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const authModal = this.page
        .locator('[role="dialog"], [role="generic"]')
        .filter({ hasText: /sign in or create an account/i })
        .first()
      if (await authModal.isVisible({ timeout: 800 }).catch(() => false)) {
        const connectWithWalletButton = authModal.getByRole('button', { name: /connect with wallet/i }).first()
        if (await connectWithWalletButton.isVisible({ timeout: 800 }).catch(() => false)) {
          await this.humanClick(connectWithWalletButton)
          await this.page.waitForTimeout(900)
        }
      }

      const web3Modal = this.page.locator('w3m-modal').first()
      const hasWeb3Modal = await web3Modal.isVisible({ timeout: 2_000 }).catch(() => false)
      const scope = hasWeb3Modal ? web3Modal : this.page

      const walletIcon = scope.getByRole('img', { name: new RegExp(walletName, 'i') }).first()
      if (await walletIcon.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await this.humanClick(walletIcon)
        return
      }

      const walletRowButton = scope.locator('button').filter({
        hasText: nameRe
      }).first()
      if (await walletRowButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await this.humanClick(walletRowButton)
        return
      }

      const walletText = scope.getByText(nameRe).first()
      if (await walletText.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await this.humanClick(walletText)
        return
      }

      const walletCssFallback = scope
        .locator(
          `[data-testid*="${walletLower}" i], [alt*="${walletLower}" i], [aria-label*="${walletLower}" i], [title*="${walletLower}" i]`
        )
        .first()
      if (await walletCssFallback.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await this.humanClick(walletCssFallback)
        return
      }

      if (await this.clickWalletByTextInShadowDom(walletName)) {
        return
      }

      // Fallback for long wallet lists: search by wallet name and click result.
      const searchInput = scope
        .locator('input[placeholder*="search wallet" i], input[aria-label*="search wallet" i], input[type="search"]')
        .first()
      if (await searchInput.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await searchInput.fill(walletName)
        await this.page.waitForTimeout(500)

        const searchedWalletButton = scope.locator('button').filter({ hasText: nameRe }).first()
        if (await searchedWalletButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await this.humanClick(searchedWalletButton)
          return
        }

        const searchedWalletText = scope.getByText(nameRe).first()
        if (await searchedWalletText.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await this.humanClick(searchedWalletText)
          return
        }
      }

      if (!hasWeb3Modal) {
        await this.waitCaptchaAndClickConnectWithWallet()
      } else {
        await this.page.waitForTimeout(1200)
      }
    }

    throw new Error(`Failed to select wallet: ${walletName}`)
  }

  async selectEvmNetworks() {
    await expect(this.page.getByText(/select chain/i).first()).toBeVisible({ timeout: 20_000 })

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const evmRowButton = this.page
        .locator('button:has-text("EVM Networks"), [role="button"]:has-text("EVM Networks")')
        .first()
      if (await evmRowButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await this.humanClick(evmRowButton)
        return
      }

      const evmNetworksIcon = this.page.getByRole('img', { name: /evm networks/i }).first()
      if (await evmNetworksIcon.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await this.humanClick(evmNetworksIcon)
        return
      }

      await this.page.waitForTimeout(700)
    }

    throw new Error('EVM Networks option was not clickable on Select Chain modal.')
  }

  async openAccountTab() {
    await this.page.goto('https://dev.tradegenius.com/account?tab=account', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/tradegenius\.com\/account\?tab=account/i)
  }

  async assertUsernameStartsWithTestUser() {
    console.log('[AssetPage] Account assert: checking username starts with "@test_user"...')
    const username = this.page.getByText(/^@test_user/i).first()
    await expect(username).toBeVisible({ timeout: 15_000 })
    const usernameText = (await username.textContent())?.trim() ?? ''
    console.log(`[AssetPage] Account assert: username matched -> "${usernameText}"`)
  }

  async openWalletsTab() {
    const walletsTab = this.page.getByText(/^wallets$/i).first()
    await expect(walletsTab).toBeVisible({ timeout: 12_000 })
    await this.humanClick(walletsTab)
    await expect(this.page.getByText(/evm networks/i).first()).toBeVisible({ timeout: 12_000 })
  }

  async assertEvmWalletAddressMatches(expectedAddress: string) {
    console.log('[AssetPage] Wallets assert: checking EVM address against PHANTOM_ADDRESS...')
    const normalizedExpected = this.normalize(expectedAddress)
    if (!/^0x[a-f0-9]{40}$/i.test(normalizedExpected)) {
      throw new Error('PHANTOM_ADDRESS is missing or invalid. Expected full EVM address in .env')
    }

    const evmWalletRow = this.page
      .locator('div, li, tr')
      .filter({ hasText: /evm wallet|evm networks/i })
      .first()
    await expect(evmWalletRow).toBeVisible({ timeout: 12_000 })

    const rowText = (await evmWalletRow.textContent()) ?? ''
    console.log(`[AssetPage] Wallets assert: EVM row text -> "${rowText.replace(/\s+/g, ' ').trim()}"`)
    const addressMatch = rowText.match(/0x[a-fA-F0-9]{6,40}(?:(?:\.{3}|…)[a-fA-F0-9]{4,40})?/)
    if (!addressMatch) {
      throw new Error('Could not find EVM address text in Wallets tab')
    }

    const uiAddress = addressMatch[0]
    console.log(`[AssetPage] Wallets assert: uiAddress="${uiAddress}", expected="${expectedAddress}"`)
    if (uiAddress.includes('...') || uiAddress.includes('…')) {
      const [prefix, suffix] = uiAddress.toLowerCase().split(/\.{3}|…/)
      console.log(`[AssetPage] Wallets assert: shortened compare -> prefix="${prefix}", suffix="${suffix}"`)
      expect(normalizedExpected.startsWith(prefix)).toBe(true)
      expect(normalizedExpected.endsWith(suffix)).toBe(true)
      console.log('[AssetPage] Wallets assert: shortened address matched.')
      return
    }

    expect(this.normalize(uiAddress)).toBe(normalizedExpected)
    console.log('[AssetPage] Wallets assert: full address matched.')
  }

  async acceptTosIfShown(waitForFirstPageMs = 0) {
    if (waitForFirstPageMs > 0) {
      await expect
        .poll(async () => (await this.detectActiveModalType()) === 'tos', {
          timeout: waitForFirstPageMs,
          intervals: [300, 500, 700, 1000]
        })
        .toBe(true)
        .catch(() => {})
    }

    const tosVisibleInitially = (await this.detectActiveModalType()) === 'tos'
    if (!tosVisibleInitially) {
      return false
    }

    for (let pageNo = 1; pageNo <= 2; pageNo += 1) {
      // If 2FA sits on top of ToS, close it first.
      const activeBefore = await this.detectActiveModalType()
      if (activeBefore === '2fa') {
        await this.skipTwoFactorIfShown().catch(() => {})
      }

      const activeNow = await this.detectActiveModalType()
      if (activeNow !== 'tos') {
        if (pageNo === 1) return false
        break
      }

      const confirmButtonGlobal = this.page.getByRole('button', { name: /confirm|i accept|accept|agree|continue/i }).last()
      const tosModal = this.page
        .locator('[role="dialog"], [role="generic"], div')
        .filter({
          has: confirmButtonGlobal
        })
        .last()
      const confirmButton = tosModal.getByRole('button', { name: /confirm|i accept|accept|agree|continue/i }).first()

      let modalShown = true
      try {
        await expect.poll(
          async () => {
            const modalVisible = await tosModal.isVisible().catch(() => false)
            const buttonVisible = await confirmButton.isVisible().catch(() => false)
            return modalVisible && buttonVisible
          },
          { timeout: pageNo === 1 ? 8_000 : 6_000, intervals: [300, 500, 700] }
        ).toBe(true)
      } catch {
        modalShown = false
      }

      if (!modalShown) {
        if (pageNo === 1) {
          throw new Error('ToS modal is visible but active ToS container with confirmation button was not detected.')
        }
        // Second page may not appear in some runs; stop gracefully.
        break
      }

      const pageIndicator = tosModal.getByText(/1\/2|2\/2/i).first()
      const pageMarker = (await pageIndicator.textContent().catch(() => '')).trim()
      console.log(`[AssetPage] ToS detected on page ${pageNo}/2. UI marker: ${pageMarker || 'not-found'}`)

      // TODO: leave your note here for Terms (1/2, 2/2): button must be disabled before scroll, enabled after scroll.
      console.log(`[AssetPage] ToS ${pageNo}/2: asserting "I Accept" is disabled before scroll...`)
      const enabledBefore = await confirmButton.isEnabled().catch(() => false)
      if (enabledBefore) {
        throw new Error(`ToS ${pageNo}/2: expected button to be disabled before scroll, but enabled=${enabledBefore}.`)
      }
      console.log(`[AssetPage] ToS ${pageNo}/2: disabled assertion passed.`)

      // Bring focus to the active ToS modal before scroll attempts.
      await tosModal.click({ position: { x: 20, y: 20 }, force: true, timeout: 1_000 }).catch(() => {})

      let enabled = await confirmButton.isEnabled().catch(() => false)
      for (let attempt = 1; attempt <= 12 && !enabled; attempt += 1) {
        console.log(`[AssetPage] ToS ${pageNo}/2: scroll attempt ${attempt}, buttonEnabled=${enabled}`)
        const scrolled = await this.scrollTermsModalToBottom(tosModal)
        if (!scrolled) {
          break
        }
        await this.page.mouse.wheel(0, 1200).catch(() => {})
        await this.page.waitForTimeout(180).catch(() => {})
        enabled = await confirmButton.isEnabled().catch(() => false)
      }

      if (!enabled) {
        throw new Error(`ToS ${pageNo}/2: confirm button did not enable after scrolling.`)
      }

      console.log(`[AssetPage] ToS ${pageNo}/2: asserting "I Accept" is enabled after scroll...`)
      await expect(confirmButton).toBeEnabled({ timeout: 8_000 })
      console.log(`[AssetPage] ToS ${pageNo}/2: enabled assertion passed, clicking button...`)
      await this.humanClick(confirmButton)
      await this.page.waitForTimeout(900)
    }

    return true
  }

  async skipTwoFactorIfShown() {
    if ((await this.detectActiveModalType()) === 'tos') return true

    const twoFactorTitle = this.page
      .getByText(/two-factor authentication|two factor authentication|set up your security/i)
      .first()
    const titleVisible = await twoFactorTitle.isVisible({ timeout: 1_500 }).catch(() => false)
    if (!titleVisible) return false

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      if ((await this.detectActiveModalType()) === 'tos') return true

      const skipText = this.page.getByText(/^\s*skip\s*$/i).first()
      const skipVisible = await skipText.isVisible({ timeout: 900 }).catch(() => false)
      if (!skipVisible) {
        await this.page.waitForTimeout(180).catch(() => {})
        continue
      }

      await skipText.scrollIntoViewIfNeeded().catch(() => {})
      await skipText.click({ force: true, timeout: 900 }).catch(async () => {
        const box = await skipText.boundingBox().catch(() => null)
        if (box) {
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {})
        }
      })

      const still2fa = (await this.detectActiveModalType()) === '2fa'
      if (!still2fa) return true
      await this.page.waitForTimeout(220).catch(() => {})
    }

    return (await this.detectActiveModalType()) !== '2fa'
  }


// since username could be filled in a previous run for wallet
// this modal might not be shown and this check might be skipped
  async fillRandomUsernameAndContinueIfShown(required = false) {
    const byRoleModal = this.page
      .locator('[role="dialog"], [role="generic"]')
      .filter({ hasText: /welcome|username/i })
      .first()
    const byStructureModal = this.page
      .locator('div')
      .filter({
        hasText: /username|welcome/i,
        has: this.page.getByRole('button', { name: /^next$/i }).first()
      })
      .first()

    let usernameModal = byRoleModal
    if (!(await byRoleModal.isVisible({ timeout: 2_000 }).catch(() => false))) {
      usernameModal = byStructureModal
    }

    if (!(await usernameModal.isVisible({ timeout: 8_000 }).catch(() => false))) {
      if (required) {
        throw new Error('Username modal was expected but not shown.')
      }
      console.log('[AssetPage] Username modal was not shown.')
      return
    }

    console.log('[AssetPage] Username modal detected. Filling username...')
    const usernameInput = usernameModal.locator('input, [role="textbox"]').first()
    const nextButton = usernameModal.getByRole('button', { name: /^next$/i }).first()

    await expect(usernameInput).toBeVisible({ timeout: 8_000 })
    await expect(nextButton).toBeVisible({ timeout: 8_000 })

    const randomNumber = Math.floor(Math.random() * 999) + 1
    const username = `test_user-${randomNumber}`

    // Force empty value first to make the "Next disabled before fill" assertion stable even if field is prefilled.
    await usernameInput.fill('')
    await expect(nextButton).toBeDisabled({ timeout: 3_000 })

    await usernameInput.fill(username)
    await expect(usernameInput).toHaveValue(new RegExp(username, 'i'))
    await expect(nextButton).toBeEnabled({ timeout: 3_000 })
    await this.humanClick(nextButton)
    console.log(`[AssetPage] Username filled: ${username}. Waiting 1.5s for next modal...`)
    await this.page.waitForTimeout(1_500)
  }

  async completePostConnectOnboarding() {
    const twoFactorModal = this.page.locator('[role="dialog"], [role="generic"], div').filter({
      hasText: /two-factor authentication|two factor authentication/i
    }).first()
    const usernameModal = this.page.locator('[role="dialog"], [role="generic"], div').filter({
      hasText: /welcome|username/i
    }).first()
    const usernameInput = this.page.getByRole('textbox').first()
    const usernameNext = this.page.getByRole('button', { name: /^next$/i }).first()

    let onboardingAppeared = true
    try {
      await expect
        .poll(
          async () => {
            const active = await this.detectActiveModalType()
            if (active !== 'none') return true
            const hasUsernameModal = await usernameModal.isVisible().catch(() => false)
            const hasUsernameControls =
              (await usernameInput.isVisible().catch(() => false)) &&
              (await usernameNext.isVisible().catch(() => false))
            return hasUsernameModal || hasUsernameControls
          },
          { timeout: 6_000, intervals: [300, 500, 800] }
        )
        .toBe(true)
    } catch {
      onboardingAppeared = false
    }

    // Fast path: if no onboarding modal appears shortly after connect, continue immediately.
    if (!onboardingAppeared) {
      return
    }

    let idleRounds = 0
    for (let step = 1; step <= 8; step += 1) {
      const active = await this.detectActiveModalType()
      if (active === 'tos') {
        await this.acceptTosIfShown()
        await this.page.waitForTimeout(250)
        idleRounds = 0
        continue
      }

      const has2fa = active === '2fa'
      const hasUsernameModal = await usernameModal.isVisible({ timeout: 1_200 }).catch(() => false)
      const hasUsernameControls =
        (await usernameInput.isVisible({ timeout: 1_200 }).catch(() => false)) &&
        (await usernameNext.isVisible({ timeout: 1_200 }).catch(() => false))
      const hasUsername = hasUsernameModal || hasUsernameControls

      // looks like some modals race conditions , sometimes itshows 2fa window first, sometime username
      // its minor bug that have to be fixed, as a workaround added some dirty ahck to choose what modal appeared first
      if (has2fa) {
        const skipped = await this.skipTwoFactorIfShown()
        if (!skipped) {
          throw new Error('2FA modal is visible but "Skip" could not be clicked.')
        }
        await this.page.waitForTimeout(350)
        idleRounds = 0
        continue
      }

      if (hasUsername) {
        await this.fillRandomUsernameAndContinueIfShown(false)
        await this.page.waitForTimeout(350)
        idleRounds = 0
        continue
      }

      idleRounds += 1
      if (idleRounds >= 2) {
        break
      }
      await this.page.waitForTimeout(400)
    }

    if (await this.isTosModalVisible()) {
      await this.acceptTosIfShown()
    }
  }

  /*
   * Unused currently (kept commented for possible future restore/refactor):
   * - assertAddressMatches
   * - getConnectedAddressText
   * - scrollToBottom
   */
  // async assertAddressMatches(expectedAddress: string) {
  //   const normalizedExpected = this.normalize(expectedAddress)
  //   const uiAddress = await this.getConnectedAddressText()
  //   const normalizedUi = this.normalize(uiAddress)
  //
  //   // If UI shows full address, compare full.
  //   if (/^0x[a-f0-9]{40}$/i.test(normalizedUi)) {
  //     expect(normalizedUi).toBe(normalizedExpected)
  //     return
  //   }
  //
  //   // If UI shows shortened address (e.g. 0x12...89ab), compare prefix/suffix.
  //   expect(normalizedUi).toContain(normalizedExpected.slice(0, 6))
  //   expect(normalizedUi).toContain(normalizedExpected.slice(-4))
  // }
  //
  // private async getConnectedAddressText() {
  //   const candidates = [
  //     this.page.locator('[data-testid*="address"]').first(),
  //     this.page.locator('[class*="address"]').first(),
  //     this.page.getByText(/0x[a-fA-F0-9]{4}.*[a-fA-F0-9]{4}/).first()
  //   ]
  //
  //   for (const candidate of candidates) {
  //     if (await candidate.isVisible().catch(() => false)) {
  //       const text = await candidate.textContent()
  //       if (text && text.trim()) {
  //         return text.trim()
  //       }
  //     }
  //   }
  //
  //   throw new Error('Connected wallet address element was not found')
  // }
  //
  // private async scrollToBottom(container: Locator) {
  //   const scrollable = container.locator('[data-radix-scroll-area-viewport], .overflow-auto, .overflow-y-auto').first()
  //
  //   if (await scrollable.isVisible().catch(() => false)) {
  //     await scrollable.evaluate((el) => {
  //       el.scrollTop = el.scrollHeight
  //     })
  //     return
  //   }
  //
  //   await container.evaluate((el) => {
  //     el.scrollTop = el.scrollHeight
  //   })
  // }

  private async scrollTermsModalToBottom(dialog: Locator) {
    const visible = await dialog.isVisible({ timeout: 1_500 }).catch(() => false)
    if (!visible) {
      return false
    }

    const moved = await dialog
      .evaluate((root) => {
        const isScrollable = (el: Element) => {
          const html = el as HTMLElement
          const style = window.getComputedStyle(html)
          return /(auto|scroll)/i.test(style.overflowY) && html.scrollHeight > html.clientHeight
        }

        const all = [root as Element, ...Array.from((root as Element).querySelectorAll('*'))]
        const scrollables = all.filter(isScrollable) as HTMLElement[]

        if (scrollables.length > 0) {
          for (const el of scrollables) {
            el.scrollTop = el.scrollHeight
          }
          return true
        }

        const html = root as HTMLElement
        html.scrollTop = html.scrollHeight
        return true
      })
      .catch(() => false)

    await this.page.waitForTimeout(220).catch(() => {})
    return moved
  }

  private async isTosModalVisible() {
    return (await this.detectActiveModalType()) === 'tos'
  }

  private async detectActiveModalType(): Promise<'2fa' | 'tos' | 'username' | 'none'> {
    const has2faTitle = await this.page
      .getByText(/two-factor authentication|two factor authentication|set up your security/i)
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false)
    const has2faSkip = await this.page
      .getByText(/^\s*skip\s*$/i)
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false)
    if (has2faTitle && has2faSkip) return '2fa'

    const hasTosTitle = await this.page
      .getByText(/terms of service|airdrop terms of service/i)
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false)
    const hasTosAccept = await this.page
      .getByRole('button', { name: /i accept|confirm|accept|agree|continue/i })
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false)
    if (hasTosTitle && hasTosAccept) return 'tos'

    const hasUsernameLabel = await this.page
      .getByText(/username|welcome/i)
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false)
    const hasUsernameInput = await this.page.getByRole('textbox').first().isVisible({ timeout: 300 }).catch(() => false)
    if (hasUsernameLabel && hasUsernameInput) return 'username'

    return 'none'
  }

  private normalize(value: string) {
    return value.trim().toLowerCase()
  }

  private async humanClick(target: Locator) {
    await target.scrollIntoViewIfNeeded()
    await target.hover().catch(() => {})
    await this.page.waitForTimeout(120)
    await target.click({ delay: 120, timeout: 6_000 })
    await this.page.waitForTimeout(180)
  }

  private async clickWalletByTextInShadowDom(walletName: string) {
    return await this.page.evaluate((name) => {
      const isVisible = (el: Element) => {
        const html = el as HTMLElement
        const style = window.getComputedStyle(html)
        const rect = html.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      }

      const roots: (Document | ShadowRoot)[] = [document]
      while (roots.length > 0) {
        const root = roots.shift() as Document | ShadowRoot
        const all = Array.from(root.querySelectorAll('*'))

        for (const el of all) {
          if ((el as HTMLElement).shadowRoot) {
            roots.push((el as HTMLElement).shadowRoot as ShadowRoot)
          }
        }

        for (const el of all) {
          const text = (el.textContent ?? '').trim()
          if (!text || !new RegExp(name, 'i').test(text)) continue
          if (!isVisible(el)) continue

          const clickable =
            (el.closest('button,[role="button"],a,wui-list-wallet,wui-list-item,[tabindex]') as HTMLElement | null) ??
            (el as HTMLElement)

          clickable.click()
          return true
        }
      }

      return false
    }, walletName)
  }

  private async isNetworkErrorPage() {
    const bodyText = (await this.page.locator('body').textContent())?.toLowerCase() ?? ''
    return (
      bodyText.includes('this site can’t be reached') ||
      bodyText.includes('this site cannot be reached') ||
      bodyText.includes('err_') ||
      bodyText.includes('network error')
    )
  }
}
