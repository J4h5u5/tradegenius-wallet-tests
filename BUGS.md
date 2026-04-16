
## 001 - onboarding modals race conditions
### Summary:
Race condition in post-connect onboarding modal order: sometimes "Two-Factor Authentication" appears first, sometimes "Username" appears first (also "ToS" appears first), causing flaky automation behavior.
### Steps to Reproduce:

1. Complete Captcha and connect wallet on `https://dev.tradegenius.com/asset` multiple times.
2. Observe post-connect onboarding sequence after wallet connection.
3. Compare runs where 2FA appears first vs runs where Username appears first.
### Expected vs. Actual Result:
**Expected**: Onboarding flow should be deterministic, or UI should handle both modal orders consistently so automation can continue without conditional recovery.
**Actual**: Modal order is inconsistent between runs; tests fail or take fallback paths when the unexpected modal appears first.
### Severity:
Medium (causes flaky tests and unstable sign-in automation flow).

## 002 [Flaky] Error after closing 'Sign in or create an account'
### Summary:
Closing the `Sign in or create an account` modal can leave the auth flow in an inconsistent state and break the next wallet-connect steps.
### Steps to Reproduce:
1. Open `https://dev.tradegenius.com/asset`.
2. Click `Sign In`.
3. Close the `Sign in or create an account` modal using `X`.
4. Click `Sign In` again and continue with wallet connect flow.
5. Repeat the run several times.
### Expected vs. Actual Result:
**Expected**: Closing/reopening sign-in modal should reset state and allow stable continuation of wallet connection.
**Actual**: Flow sometimes becomes invalid after closing/reopening (missing/incorrect modal state, skipped transitions, or failed connect), causing flaky test failures.
### Severity:
High



## 003 - sometimes 'Sign in or create an account' opens without Google and Apple buttons
### Summary:
The `Sign in or create an account` modal intermittently opens with only the wallet/captcha button and without `Continue with Google` and `Continue with Apple`.
### Steps to Reproduce:
1. Open `https://dev.tradegenius.com/asset`.
2. Click `Sign In`.
3. Observe the `Sign in or create an account` modal.
4. Repeat multiple times.
### Expected vs. Actual Result:
**Expected**: Modal always shows all expected auth options (`Google`, `Apple`, and `Connect with Wallet`).
**Actual**: In some runs, `Google` and `Apple` are missing; only one auth button is shown.
### Severity:
High


## 004 - after few minutes of inactivity of the page - page crushes
### Summary:
After several minutes of user inactivity, the page crashes and the active flow is interrupted.
### Steps to Reproduce:
1. Open `https://dev.tradegenius.com/asset`.
2. Start any normal flow (for example sign-in/wallet connect) and leave the page idle.
3. Wait a few minutes without interacting.
4. Observe page behavior after inactivity period.
### Expected vs. Actual Result:
**Expected**: Page should remain stable and interactive after inactivity.
**Actual**: Page crashes after a few minutes of inactivity, requiring reload/restart of the flow. There is a TypeError: Cannot read properties of undefined (reading 't') in DevTools
### Severity:
Critical

## 005 - Displayed in profile wallet address doesnt match with an imported wallet address
### Summary:
Probably i didnt undestood the logics correct... In Account Settings -> Wallets, the displayed EVM wallet address does not match the imported wallet address from test configuration (`PHANTOM_ADDRESS`).
### Steps to Reproduce:

1. Complete wallet connection flow on `https://dev.tradegenius.com/asset`
2. Open `https://dev.tradegenius.com/account?tab=account`
3. Open `Wallets` tab and check `EVM Wallet` displayed address
4. Compare displayed address with imported address in 
### Expected vs. Actual Result:
**Expected**: Displayed EVM wallet address in profile matches the imported wallet address used for connection.
**Actual**: Displayed EVM wallet address is different from the imported wallet address.
### Severity:
High


## 006 - Placeholder for 0 USD displays as NaN in Withdraw modal
###  Summary:
In Withdraw modal there is an input for withdraw amount , by default it is $0 and on the right side the equivalent is displayed as NaN
### Steps to Reproduce:
1. Complete wallet connection flow on `https://dev.tradegenius.com/asset`.
2. Hover on Portfolio icon
3. Open Withdraw modal
### Expected vs. Actual Result:
**Expected**: ~Equivalent should not be displayed for 0$ (or should be 0, but i think its bad practice)
**Actual**: Displays NaN for 0$ (as an initial value)
### Severity:
Low


## 007 - Infinite request for coin icons

### Summary:
There is an endless loop of request for the icon files
### Steps to Reproduce:
1. open https://dev.tradegenius.com/asset
2. open DevTools - Network - All 
### Expected vs. Actual Result:
**Expected**: Icons should be loaded once 
**Actual**: Request are fetching constantly even less then every second
### Severity:
High


## 008 - Explorer page crashes


### Summary:
There is application error after opening https://app.bridgesmarter.com/explorer
### Steps to Reproduce:
1. open https://app.bridgesmarter.com/explorer
### Expected vs. Actual Result:
**Expected**: Explorer page opens
**Actual**: /explorer page is not opens correctly . https://app.bridgesmarter.com/_next/image - 400 and https://app.bridgesmarter.com/api/monitoring/time-series - 500 errors in network . Also there is a TypeError from index page.  
### Severity:
Critical
