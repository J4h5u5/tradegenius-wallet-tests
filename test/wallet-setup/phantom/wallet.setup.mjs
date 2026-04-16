import 'dotenv/config'
import { defineWalletSetup } from '@synthetixio/synpress'
import { Phantom } from '@synthetixio/synpress/playwright'

const SEED_PHRASE = process.env.PHANTOM_SEED_PHRASE
const PASSWORD = process.env.WALLET_PASSWORD

if (!SEED_PHRASE || !PASSWORD) {
  throw new Error('Missing PHANTOM_SEED_PHRASE or WALLET_PASSWORD in .env')
}

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const phantom = new Phantom(context, walletPage, PASSWORD)
  await phantom.importWallet(SEED_PHRASE)
})
