Please review the existing source code first, understand the current architecture, and then IMPLEMENT this feature.

FEATURE: Admin Withdrawal Verification / User Fund Statement

GOAL

I want to make withdrawals safer and prevent financial loss caused by users exploiting bugs, APIs, frontend state, token balance, payment logic, race conditions, or any other weakness in the system.

Example:

A user actually deposited only:

10 VND

But because of a bug/exploit, their account somehow shows:

Balance = 1,000,000 VND

Then the user requests a withdrawal of:

1,000,000 VND

If the admin trusts the displayed balance and transfers the money, we lose money.

Therefore, I want an Admin Fund Verification / Statement feature.

==================================================
1. FIRST: REVIEW THE EXISTING SOURCE CODE
==================================================

Before changing anything, inspect the current implementation and trace the complete flow:

Payment/Deposit
    ↓
User balance/token
    ↓
Withdrawal request
    ↓
Admin Withdrawals page
    ↓
Admin approves/rejects/transfers money

Find the actual:

- frontend Withdrawal page
- withdrawal components
- withdrawal APIs
- payment/deposit APIs
- payment webhook/callback handling
- balance/token calculation
- database models/tables
- withdrawal models/tables
- transaction/payment history
- code that credits balance
- code that deducts balance
- admin approval logic
- authentication/authorization logic

Do not assume the architecture.

Use the existing project architecture and coding patterns where possible.

==================================================
2. BUILD THE ADMIN USER FUND STATEMENT
==================================================

On the existing Admin Withdrawals page:

When the admin clicks a withdrawal request from User A, open a detail page, drawer, or modal showing the financial history of that user.

The admin should be able to answer:

"Where did this user's withdrawable money actually come from?"

Show:

USER INFORMATION

- User ID
- Name
- Email
- Current stored balance/token
- Requested withdrawal amount
- Pending withdrawal amount
- Verified withdrawable balance
- Total confirmed deposits
- Total successful withdrawals

SOURCE OF FUNDS / DEPOSIT HISTORY

Show all relevant deposits/payments belonging to this user.

For every transaction, show available information such as:

- Date/time
- Amount
- Transaction ID
- Payment ID
- Bank transaction/reference
- Payment method
- Sender/reference information if available
- Receiving account if available
- Status
- Amount of balance/token credited
- Related order/reference

Statuses may include:

- Pending
- Confirmed
- Failed
- Cancelled
- Refunded

Also show other balance-affecting transactions if the system supports them:

- Rewards
- Credits
- Refunds
- Purchases/spending
- Admin adjustments
- Previous withdrawals
- Pending withdrawals
- Completed withdrawals
- Rejected withdrawals

==================================================
3. VERIFIED BALANCE
==================================================

Do NOT treat the current user.balance/token value as proof that the money is legitimate.

Calculate a server-side Verified Withdrawable Balance based on legitimate financial records.

Conceptually:

Verified Withdrawable Balance =
    legitimate confirmed credits
    - spending/deductions
    - completed withdrawals
    - pending/reserved withdrawals
    - refunds/reversals where applicable

Adapt the exact calculation to the actual business logic found in the project.

Example:

Stored balance:
1,000,000 VND

Verified legitimate transaction history:
Deposit #1: +10 VND

Verified balance:
10 VND

Withdrawal requested:
1,000,000 VND

Result:

BLOCK APPROVAL

Admin should see a prominent warning:

CRITICAL BALANCE MISMATCH
Stored balance: 1,000,000 VND
Verified balance: 10 VND
Requested withdrawal: 1,000,000 VND

DO NOT APPROVE

==================================================
4. WITHDRAWAL SECURITY
==================================================

The frontend must NOT be the source of truth.

Do not trust values submitted by the client such as:

- user balance
- token balance
- user ID
- payment status
- withdrawal eligibility
- calculated available balance

Backend must retrieve and verify authoritative information itself.

When the admin approves a withdrawal, perform verification AGAIN on the backend immediately before approval.

If:

requested_amount > verified_withdrawable_balance

the backend must reject the approval.

This protection must exist even if someone bypasses the Admin UI and calls the API directly.

Use proper database transactions/locking where necessary so concurrent requests cannot bypass the check.

==================================================
5. SECURITY REVIEW
==================================================

While implementing the feature, review the existing code for possible ways a user could create fake balance or withdraw more than they legitimately own.

Check for:

- frontend balance manipulation
- direct API manipulation
- changing withdrawal amount
- changing user_id
- IDOR
- missing authorization
- client-controlled payment status
- fake payment confirmation
- unverified payment webhooks
- webhook replay
- duplicate payment credit
- duplicate withdrawal
- concurrent withdrawal requests
- race conditions
- double spending
- negative amount
- zero amount
- invalid decimal values
- floating-point money calculation
- integer overflow/precision problems
- pending money being reused
- refunded payment still contributing to balance
- cancelled/failed payment contributing to balance
- multiple code paths that modify balance
- debug/internal/admin endpoints exposed to normal users

Search the codebase for ALL locations that can modify:

- balance
- token
- wallet
- credit
- deposit
- payment
- withdrawal

The important security invariant is:

NO VERIFIED SOURCE OF FUNDS = NO WITHDRAWAL.

Changing user.balance alone must never be enough to withdraw real money.

==================================================
6. IMPLEMENTATION
==================================================

After understanding the current architecture, implement the feature.

Prefer minimal, maintainable changes that fit the existing project.

Add or modify as required:

- database/schema
- backend services
- APIs
- withdrawal validation
- transaction/ledger logic
- Admin Withdrawal UI
- User Fund Statement UI
- suspicious balance warning
- authorization
- concurrency protection
- idempotency protection
- tests

If the existing database already contains enough transaction information, reuse it instead of unnecessarily creating duplicate systems.

If the current data model cannot reliably prove where a user's balance came from, introduce the minimum required ledger/audit structure.

==================================================
7. ADMIN UX
==================================================

Example:

Withdrawal Request
--------------------------------

User: User A
Requested: 1,000,000 VND

Stored Balance:
1,000,000 VND

Verified Balance:
10 VND

Pending Withdrawals:
0 VND

Risk:
CRITICAL

⚠ BALANCE MISMATCH
⚠ REQUEST EXCEEDS VERIFIED FUNDS

--------------------------------
SOURCE OF FUNDS
--------------------------------

01/08/2026
+10 VND
Bank Transfer
TX-001
Confirmed

Total confirmed funds:
10 VND

--------------------------------
WITHDRAWAL HISTORY
--------------------------------

Previous withdrawal records...

The admin must be able to inspect this before transferring real money.

==================================================
8. AFTER IMPLEMENTATION
==================================================

After implementing everything:

1. Review your own changes again.
2. Trace Payment → Balance → Withdrawal end-to-end.
3. Verify authorization.
4. Verify the frontend cannot bypass backend validation.
5. Test direct API requests.
6. Test duplicate requests.
7. Test concurrent withdrawals.
8. Test a fake stored balance.
9. Test pending/failed/refunded deposits.
10. Test withdrawal amount greater than verified balance.
11. Run existing relevant tests.
12. Add regression/security tests for the new behavior.

Specifically test this scenario:

Real confirmed deposit = 10 VND
Stored user balance = 1,000,000 VND
Withdrawal request = 1,000,000 VND

Expected:

- Admin UI shows the mismatch.
- Approval is blocked.
- Direct API approval is also blocked.
- Maximum legitimate withdrawable amount remains 10 VND or less depending on other deductions.

Finally provide me with:

- What you found in the original architecture
- Security problems discovered
- Files changed
- Database changes
- APIs changed/added
- UI changes
- How Verified Withdrawable Balance is calculated
- Security protections added
- Tests performed and results
- Any remaining risks

Do not stop after only giving me a plan.

Review the source code, implement the feature, test it, and then review the final implementation again.