import 'dotenv/config'
import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'

const SEED_PHRASE = process.env.METAMASK_SEED_PHRASE
const PASSWORD = process.env.WALLET_PASSWORD

if (!SEED_PHRASE || !PASSWORD) {
  throw new Error('Missing METAMASK_SEED_PHRASE or WALLET_PASSWORD in .env')
}

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD)
  await metamask.importWallet(SEED_PHRASE)
})
