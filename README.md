# GovLedger

A prototype blockchain dapp for government transparency. Every government
project, its budget, its milestones, and its spending are written to a
public ledger on chain. Anyone can look up a project and see exactly who
is responsible for it. Only recognized officials can write new entries,
and every write is signed by the wallet that made it, so there is
always an on chain trail of who recorded what.

This is a prototype: it runs on a local test blockchain (anvil) with
test accounts and test funds, not a real network. See "Moving beyond
the prototype" at the bottom for what changes when you take this further.

## What it does

- **Departments**: government departments, each with a department head.
- **Officials**: wallet addresses registered under a department by that
  department's head, and removable by that head (or the super admin)
  if they should no longer have access.
- **Projects**: a project belongs to a department, has one responsible
  official, an allocated budget, and a running spent amount.
- **Milestones**: a project can have any number of milestones, each
  markable complete with an optional evidence link.
- **Spending records**: every payment against a project is logged with
  an amount, purpose, recipient, and who recorded it. The contract
  will not let recorded spending exceed the allocated budget.
- **Citizen reports**: anyone with a wallet can leave an on chain
  comment on a project, for example flagging that a "completed"
  project doesn't look finished. Officials can triage a report through
  a real lifecycle (Open -> Under review -> Resolved/Dismissed), and
  every status change records who made it and when.
- **Tenders**: a department can publish a tender (optionally linked to
  a project), anyone (a company, a contractor, an ordinary wallet) can
  submit a bid with no registry role required, and an official closes
  bidding and awards it to one of the submitted bids. Every bid and
  every award decision is public, so it's always possible to see who
  bid what and who actually won a government contract.
- **Sign-in gated Official Portal**: connecting a wallet is not enough
  to reach privileged screens. An address that GovRegistry recognizes
  as a department head, official, or the super admin has to also sign
  a one time message (no transaction, no gas) proving they control
  that wallet before the Portal unlocks. Ordinary visitors never see
  privileged controls at all, they get a clean read only site plus the
  ability to file reports.

Reading any of this requires no wallet at all. Writing to it requires a
wallet that GovRegistry recognizes as either the super admin, a
department head, or an official of the relevant department, and (in
the frontend) having signed in to the Portal.

## Architecture

```
govledger/
  contracts/     Solidity contracts, tests, and deploy scripts (Foundry)
  frontend/      React + Vite + ethers.js single page app
  scripts/       Orchestration scripts that wire the two together
```

### Contracts (`contracts/src`)

Three contracts, deliberately kept separate so each has one job:

- **GovRegistry.sol** is the identity and permissions layer. It knows
  about departments, who heads each one, and which addresses are
  active officials of which department. It exposes
  `isAuthorizedForDepartment(address, departmentId)`, which is the one
  question every other contract needs answered.
- **ProjectLedger.sol** is the public ledger of projects: milestones,
  spending records, and citizen reports. It never manages permissions
  itself, it just asks GovRegistry (through the `IGovRegistry`
  interface) whether the caller is allowed to act for a project's
  department.
- **Tender.sol** is the public procurement register: a department
  opens a tender, anyone can submit a bid (no registry role needed,
  the same way citizen reports work), and an official closes bidding
  and awards it to one of the bids. It also only depends on
  `IGovRegistry`, not on ProjectLedger, a tender can optionally carry
  a `relatedProjectId` as an informational link, but that's never
  validated cross contract, keeping Tender and ProjectLedger
  independent of each other.

Keeping permissions in one contract and everything else in modules
that each only depend on `IGovRegistry` means you can add a fourth
contract later (say, a document-attachment registry) that asks
GovRegistry the same question, without touching any of the three
existing contracts. See "Adding a new module" below.

Roles, using OpenZeppelin's AccessControl:

- `DEFAULT_ADMIN_ROLE`: the super admin (whoever deployed GovRegistry,
  or anyone that role is later transferred to). Creates departments
  and assigns department heads.
- `DEPARTMENT_HEAD_ROLE`: granted per department to its head. A
  department head can add/deactivate officials under their own
  department, and can do anything an official of that department can
  do.
- `OFFICIAL_ROLE`: granted to addresses added by a department head.
  An official can create projects, add/complete milestones, record
  spending, change status, publish/manage tenders, all scoped to their
  own department.

A few things exist purely so the frontend can query efficiently
instead of scanning every id and filtering client side:

- `ProjectLedger.getDepartmentProjectIds(departmentId)` and
  `Tender.getDepartmentTenderIds(departmentId)`, both populated as
  items are created, so "show me this department's projects/tenders"
  is one call each.
- Citizen reports carry a `ReportStatus` (`Open`, `UnderReview`,
  `Resolved`, `Dismissed`) plus who triaged them and when, updated
  through `updateReportStatus`.
- A tender carries a `TenderStatus` (`Open`, `Closed`, `Awarded`,
  `Cancelled`). Awarding requires bidding to already be closed, so it
  is always a deliberate two step process rather than something that
  can happen while bids are still coming in.

Everyone else, including every visitor with no wallet at all, can read
every function marked `view`.

### Frontend (`frontend/src`)

The app uses real client side routes (React Router), not tab state, so
every screen has its own URL, works with the browser's back/forward
buttons, and can be bookmarked or shared:

```
/                       Home (public stats dashboard)
/projects               Public project list (search + filters)
/projects/:id           Public project case file
/tenders                Public tender list (search + filters)
/tenders/:id            Public tender detail (bids, award result)
/departments            Public department list

/portal                 Portal dashboard (gated, see below)
/portal/projects        Manage projects in your department(s)
/portal/projects/:id    Project case file with management controls
/portal/tenders         Manage tenders in your department(s)
/portal/tenders/:id     Tender detail with close/award/cancel controls
/portal/reports         Citizen report review queue
/portal/departments     Create departments (admin) / manage officials (head)
```

Two route groups, sharing the same components underneath:

- **Public site** (`Home`, `Projects`, `Tenders`, `Departments`, and
  `ProjectDetail`/`TenderDetail` in `mode="public"`): read only, no
  wallet required. No management controls are ever shown here, even to
  a wallet that happens to be an official, on purpose, see "Sign-in
  gating" below.
- **Official Portal** (everything under `/portal`, rendered through
  `PortalLayout`): only reachable after connecting a recognized wallet
  and signing in. This is where departments and officials get
  created/removed, projects and tenders get registered and updated,
  milestones and spending get recorded, bids get awarded, and citizen
  reports get triaged. `PortalLayout` is a route level guard, an
  unauthenticated visitor who types `/portal/projects/3` directly into
  the address bar sees the same sign-in gate as anyone else, never the
  underlying page.

`ProjectDetail.jsx` and `TenderDetail.jsx` are each used by both a
public and a portal route, a `mode` prop (set by the route definition
in `App.jsx`) controls whether management controls render, and
`useAuthorization` double checks the connected wallet is actually
allowed to act for that specific department regardless of which route
rendered the component.

Shared building blocks:

- `lib/wallet.js`: all MetaMask specific code lives here (connect,
  network switching, event subscriptions). Nothing else in the app
  talks to `window.ethereum` directly.
- `lib/auth.js`: the sign-in flow, see "Sign-in gating" below.
- `lib/contracts.js`: builds ethers `Contract` instances for all three
  contracts, both read only versions (backed by a direct RPC
  connection, so the site works without a wallet) and write versions
  (backed by the connected wallet's signer).
- `context/WalletContext.jsx`: the one piece of global state. Exposes
  the connected address/signer, whether that address is the super
  admin, which departments it can act for (`myDepartments`, each with
  a `role` of `"head"` or `"official"`), and the sign-in session.
- `hooks/useAuthorization.js`: asks GovRegistry, for a given
  department, whether the connected wallet can write to it. Every
  Portal write form is gated by this, in addition to the Portal itself
  being gated by sign-in.
- `hooks/useTxRunner.js`: turns "send a transaction" into a status
  (`idle` / `pending` / `success` / `error`) and a message, so every
  form has consistent transaction feedback without repeating that
  logic.

#### Sign-in gating

Connecting a wallet is enough to *read* whether that wallet has a
role, since that's public on-chain information anyone could look up
anyway. It is not enough to *reach* the Portal's routes. To enter the
Portal, a recognized wallet also has to sign a message (see
`lib/auth.js`, `buildSignInMessage`) proving it controls that address.
The signature costs no gas and sends no transaction, MetaMask's
"Sign" prompt is enough. The result is kept in `sessionStorage`,
scoped to that chain id, for 12 hours, and re-verified (by recovering
the signer from the stored message + signature) every time the app
checks whether a session is still valid, so a tampered or stale
sessionStorage entry can't grant access.

This is a UX/identity ceremony, not the actual security boundary, that
boundary is `isAuthorizedForDepartment` enforced inside every
`ProjectLedger`/`GovRegistry` write function regardless of what the
frontend does. If you called those functions directly with `cast`
from an unauthorized account, they would revert with no signature
involved at all. The sign-in step exists so that in the UI, "you are
an official" is a deliberate, visible step rather than something that
silently unlocks the moment MetaMask happens to be connected.

`ProjectDetail.jsx` is the one component both areas share: given a
`mode` prop, it either shows the read-only case file (public) or also
shows the management controls, gated a second time by
`useAuthorization` so a signed-in official still can't manage a
different department's project (portal).

### Scripts (`scripts/`)

- `setup.sh`: one time install of contract and frontend dependencies.
- `start-chain.sh`: runs anvil in the foreground (its own terminal),
  with enough funded accounts (16) for every demo department head,
  official, citizen, and tender vendor.
- `deploy.sh`: deploys all three contracts to whatever chain is at
  `$RPC_URL` (defaults to local anvil), seeds a demo dataset (four
  departments, a project and tender in each, a few citizen reports),
  then writes `frontend/.env.local` and syncs the compiled ABIs into
  `frontend/src/lib/generated`.
- `dev.sh`: starts the frontend dev server.
- `run-local.sh`: does all of the above in one command, starting anvil
  in the background and cleaning it up when you stop the script.

## Running it locally

You said you already have `foundryup` (forge/anvil/cast), MetaMask,
and are on Fedora, so:

```bash
cd govledger
./scripts/setup.sh      # one time: installs contract + frontend deps
./scripts/run-local.sh  # starts anvil, deploys + seeds, starts the frontend
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Every demo account (department heads, officials, the citizen, and the
tender vendors) is derived from anvil's own default test mnemonic
(`test test test test test test test test test test test junk`), so
the private keys are exactly the ones anvil itself prints on startup
for accounts 0 through 12:

| Account | Role |
| --- | --- |
| 0 | Super admin |
| 1 / 2 | Infrastructure department head / official |
| 3 / 4 | Health department head / official |
| 5 / 6 | Education department head / official |
| 7 / 8 | Water Supply department head / official |
| 9 | Ordinary citizen (no role) |
| 10 / 11 / 12 | Vendors that bid on tenders (no role) |

Import any of them into MetaMask (MetaMask -> Account menu -> Import
account -> paste private key) to try that role. `deploy.sh` also
prints this table after seeding.

- Import **account 9** (citizen) or a fresh, non-listed account to
  browse as an ordinary member of the public. You can read everything,
  file reports, and bid on open tenders, but you won't see an
  "Official Portal" link at all.
- Import an **official** or **department head** key, then click
  "Official Portal" in the header. You'll be asked to connect (if you
  haven't already) and then to sign a message, MetaMask will show a
  "Signature request", not a transaction, so it costs no gas. After
  signing you land on the Portal dashboard, scoped to your own
  department(s).
- Import **account 0** (super admin) to also see department creation
  and every department's projects/tenders in the Portal.

The first time you connect a wallet, MetaMask will ask to add/switch
to the "GovLedger Local (Anvil)" network (chain id 31337, RPC
`http://127.0.0.1:8545`). Accept that, it's how the frontend and
MetaMask agree on which chain to use.

If you'd rather run things in separate terminals (useful when you want
to keep anvil's logs visible, or restart just the frontend):

```bash
# terminal 1
./scripts/start-chain.sh

# terminal 2, once anvil is running
./scripts/deploy.sh
./scripts/dev.sh
```

Re-running `./scripts/deploy.sh` deploys fresh contracts and reseeds
demo data, which is also a quick way to reset the demo to a clean
state.

## Running the contract tests

```bash
cd contracts
forge test -vv
```

35 tests cover all three contracts: permission checks (who can create
a department, add an official, deactivate an official, create a
project, record spending, publish a tender), budget enforcement
(spending can't exceed the allocated budget), the milestone/status
flows, department-scoped project/tender indexing, the citizen-report
triage workflow, and the full tender lifecycle (anyone can bid,
bidding closes on deadline or by an official, awarding requires
bidding to be closed first, only an authorized official can close or
award, cancellation rules).

## Adding a new module

`Tender.sol` is a working example of exactly this: it only depends on
`IGovRegistry`, not on `ProjectLedger`, and was wired in without
changing either existing contract. Say you now want a "Document
Registry" module for attaching official records to a project. You
would follow the same pattern:

1. Write `DocumentRegistry.sol`, constructed with the GovRegistry
   address, same as `ProjectLedger.sol` and `Tender.sol` are.
2. Use `registry.isAuthorizedForDepartment(msg.sender, departmentId)`
   for your write checks (or leave a function open to everyone, like
   `fileCitizenReport` and `submitBid` do, if that fits the feature).
3. Add a deploy line for it in `contracts/script/Deploy.s.sol`.
4. Add its ABI to the `contracts` array in `scripts/sync-abi.mjs` and
   its address to `scripts/write-env.mjs` (and `configIsReady()` in
   `frontend/src/lib/config.js` if it should block the app from
   loading until deployed, the way the other three do).
5. Add a `getWriteDocumentRegistry` / `getReadDocumentRegistry` pair in
   `frontend/src/lib/contracts.js`.
6. Build a public page (route under `/`) and, if it needs privileged
   actions, a Portal page (route under `/portal`) the same way
   `Tenders.jsx`/`TenderDetail.jsx` and `PortalTenders.jsx` were built,
   then add the routes in `App.jsx` and a link in `PortalSubNav.jsx`
   and/or `Header.jsx`.

Nothing in GovRegistry, ProjectLedger, or Tender needs to change.

## Moving beyond the prototype

Things that are intentionally simplified for a prototype, and what
you'd revisit before going further:

- **Currency units.** Budgets and spending are stored as plain
  `uint256` amounts formatted with 18 decimals for convenience (the
  same scale as ETH), not tied to any real token. If you want the
  ledger to track an actual stablecoin or a custodial payment flow,
  that's a different design (an ERC20 transfer alongside the record,
  or an off chain payment reconciled against the on chain record).
- **Report triage has no spam resistance.** `fileCitizenReport` is
  open to anyone with a wallet, and there's no rate limit or bond, so
  a real deployment would likely want one before opening this up
  publicly. The lifecycle (Open/UnderReview/Resolved/Dismissed) is
  real now, just not yet defended against spam.
- **Sign-in sessions are per-tab and per-chain, not shared across
  devices.** That's normal for a SIWE-style flow with no backend. If
  you later add a server (for notifications, off chain indexing, etc.)
  you'd exchange that signature for a proper server-side session
  instead of only keeping it in `sessionStorage`.
- **No document/evidence storage.** `evidenceURI` on a milestone is
  just a string. In practice you'd pin evidence (photos, reports,
  receipts) to IPFS or Arweave and store the resulting URI here.
- **Deploying beyond a local chain.** To move from anvil to a public
  testnet (Sepolia, etc.), you only need to change `RPC_URL` and use a
  real funded deployer key (get testnet ETH from a faucet), then run
  `scripts/deploy.sh` with `RPC_URL` and `CHAIN_ID` set accordingly.
  The contracts themselves don't change.
- **Hosting the frontend.** The task said Cloudflare Workers for
  hosting; once the dapp works locally, `frontend/` is a standard Vite
  app, so it deploys to Cloudflare Workers/Pages the same way any Vite
  app does (`npm run build`, then point Cloudflare's static asset
  hosting at `frontend/dist`, or use Wrangler). One thing that will
  need attention at that point and doesn't matter locally: since
  routing is client side now (React Router), the host needs to serve
  `index.html` for any unmatched path (a "SPA fallback"), not just
  `/`, or a direct link to something like `/projects/3` will 404.
  Vite's own dev server already does this automatically, which is why
  it's not visible as an issue while running locally.
