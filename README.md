# tradegenius-wallet-tests

## Notes
I had an issues with MetaMask connection so skipped this test now . The reason is that Synpress doesnt work with a latest version of the MM 13. Was trying to find a previous stable verion but decided to skip for now, Phantom wallet works good enough. 
Still i am not happy with a result. Its not final, there is alot of "dirty hacks", alot of things places should be refactored, but there was not enough time. There is also some elements without ids or clear locators that should be fixed from the frontend side for good (for example there was a problem with small icon for profile, so i decided to open /account by url. 

Minimal local Synpress project with 2 tests:
- Phantom connect flow
- MetaMask connect flow (doesnt work now) 




## 1) Local setup

```bash
npm install
npx playwright install chromium
```

## 2) Configure env

```bash
cp .env.example .env
```

Fill in:
- `METAMASK_SEED_PHRASE`
- `PHANTOM_SEED_PHRASE`
- `WALLET_PASSWORD`
- `PHANTOM_ADDRESS` (full EVM address used in Phantom wallet assertion)
- `BASE_URL` (default: `https://dev.tradegenius.com/asset`)

## 3) Build wallet caches

```bash
npm run cache:phantom:smart
```

## 4) Run tests

```bash
npm run test:phantom
```



