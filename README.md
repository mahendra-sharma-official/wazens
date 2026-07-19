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

- **Departments**: government departments, each with a named head.
  Creating one can immediately staff it with its first officials too,
  the super admin doesn't have to wait for the head to log in.
- **Officials**: wallet addresses registered under a department by
  that department's head (or the admin), removable by that head (or
  the super admin), with who added or removed them and when recorded
  on chain, since a manually entered address should always have an
  accountable source.
- **Officials registry**: every department head and official, past
  and present, is browsable in one public directory with its own
  profile page per address, an activity history built directly from
  on chain events (projects they're responsible for, spending they've
  recorded, milestones they've completed, tenders they've published or
  awarded, reports they've triaged), and aggregate stats like total
  spending recorded. Nowhere else in the app makes you type an
  official's address by hand, project creation and reassignment use a
  dropdown sourced from this same registry.
- **Projects**: a project belongs to a department, has one responsible
  official (chosen from a dropdown, reassignable later the same way),
  an allocated budget, and a running spent amount.
- **Milestones**: a project can have any number of milestones, each
  markable complete with an optional evidence link.
- **Spending records**: every payment against a project is logged with
  an amount, purpose, recipient, and who recorded it. The contract
  will not let recorded spending exceed the allocated budget.
- **Citizen reports, gas-free**: anyone can leave an on chain comment
  on a project, for example flagging that a "completed" project
  doesn't look finished, without ever needing ETH in their wallet.
  They sign a message (no transaction), a relayer submits it for them,
  and a dedicated, publicly inspectable treasury reimburses that
  relayer's gas. See "Gasless citizen reporting" below. Officials can
  triage a report through a real lifecycle (Open -> Under review ->
  Resolved/Dismissed), and every status change records who made it and
  when.
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
  ability to file reports and browse the officials registry, all free.

Reading any of this, filing a citizen report, and browsing the
officials registry all require no ETH at all. Writing anything else
requires a wallet that GovRegistry recognizes as either the super
admin, a department head, or an official of the relevant department,
and (in the frontend) having signed in to the Portal.

## Gasless citizen reporting

The public should never have to pay to view the ledger or to report a
concern. Viewing was already free (every read is a `view` call over a
plain RPC connection, no wallet needed at all). Reporting needed more
thought, since filing a report is normally a transaction, and
transactions cost gas.

The flow, spread across three pieces:

1. **`ProjectLedger.fileCitizenReportBySignature`**: a citizen signs an
   EIP-712 typed message ("CitizenReport": reporter, project id,
   comment, nonce) with their wallet. MetaMask shows this as a
   signature request, not a transaction: no gas, works with a zero
   balance wallet. The contract recovers the signer from that
   signature and records the report under their address, whoever
   actually submits the surrounding transaction never has authorship,
   only the signer does.
2. **`ReportingTreasury.sol`**: a small contract holding ETH for
   exactly one purpose. Anyone can call `sponsorReport`, which forwards
   the citizen's signed report into ProjectLedger and then reimburses
   whoever called it (the relayer) for the gas they just spent, capped
   at the treasury's balance. Every top up, every reimbursement, and
   the running "total spent sponsoring reports" figure are public
   contract state, shown on the home page.
3. **`relayer/`**: a small local Node process (see "Running it
   locally") that receives a citizen's signature from the frontend,
   calls `sponsorReport`, and pays that transaction's gas out of its
   own balance up front. Anyone can run one, relayers hold no special
   permission, the signature is what authenticates the reporter, not
   who relays it.

Officials and department heads still pay their own gas for
privileged actions (creating projects, recording spending, awarding
tenders, and so on) the ordinary way, only citizen reporting gets this
treatment, since that's the one action meant for literally anyone.

## Architecture

```
govledger/
  contracts/     Solidity contracts, tests, and deploy scripts (Foundry)
  frontend/      React + Vite + ethers.js single page app
  relayer/       Small local Node process that sponsors citizen reports
  scripts/       Orchestration scripts that wire it all together
```

### Contracts (`contracts/src`)

Four contracts, deliberately kept separate so each has one job:

- **GovRegistry.sol** is the identity and permissions layer, and the
  officials registry: departments (each with a named head), and every
  address ever registered as an official, including who added or
  deactivated them and when. It exposes
  `isAuthorizedForDepartment(address, departmentId)`, which is the one
  question every other contract needs answered.
- **ProjectLedger.sol** is the public ledger of projects: milestones,
  spending records, and citizen reports (including the signature based
  gasless path, see `fileCitizenReportBySignature`). It never manages
  permissions itself, it just asks GovRegistry (through the
  `IGovRegistry` interface) whether the caller is allowed to act for a
  project's department.
- **Tender.sol** is the public procurement register: a department
  opens a tender, anyone can submit a bid (no registry role needed,
  the same way citizen reports work), and an official closes bidding
  and awards it to one of the bids. It also only depends on
  `IGovRegistry`, not on ProjectLedger, a tender can optionally carry
  a `relatedProjectId` as an informational link, but that's never
  validated cross contract, keeping Tender and ProjectLedger
  independent of each other.
- **ReportingTreasury.sol** holds ETH for one purpose: reimbursing
  whoever relays a citizen's signed report. It depends only on
  ProjectLedger (to call the signature based report function), not on
  GovRegistry at all, since sponsoring a report needs no permission
  check, anyone can fund it and anyone can call it.

Keeping permissions in one contract and everything else in modules
that each only depend on what they actually need means you can add a
fifth contract later (say, a document-attachment registry) without
touching any of the four existing ones. See "Adding a new module"
below.

Roles, using OpenZeppelin's AccessControl:

- `DEFAULT_ADMIN_ROLE`: the super admin (whoever deployed GovRegistry,
  or anyone that role is later transferred to). Creates departments
  (optionally staffing them with initial officials in the same
  session) and assigns department heads.
- `DEPARTMENT_HEAD_ROLE`: granted per department to its head. A
  department head can add/deactivate officials under their own
  department, and can do anything an official of that department can
  do.
- `OFFICIAL_ROLE`: granted to addresses added by a department head.
  An official can create projects, add/complete milestones, record
  spending, change status, publish/manage tenders, all scoped to their
  own department.

Every write that adds or removes an official records who did it and
when (`OfficialInfo.addedBy` / `addedAt` / `deactivatedBy` /
`deactivatedAt`), and every event that names an official as having
done something (created a project, recorded spending, completed a
milestone, published or awarded a tender, triaged a report) indexes
that address as a topic. Together these are what the officials
registry's per-profile activity history is built from, by querying
event logs directly rather than maintaining a separate off-chain
index, see `frontend/src/hooks/useOfficialHistory.js`.

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
/                       Home (public stats dashboard, treasury balance)
/projects               Public project list (search + filters)
/projects/:id           Public project case file
/tenders                Public tender list (search + filters)
/tenders/:id            Public tender detail (bids, award result)
/officials              Public officials registry (search + filters)
/officials/:address     Public official profile + on-chain activity history
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
- `lib/auth.js`: the Portal sign-in flow, see "Sign-in gating" below.
- `lib/relay.js`: builds the EIP-712 typed data for a citizen report
  and posts the signed result to the local relayer, see "Gasless
  citizen reporting" above.
- `lib/contracts.js`: builds ethers `Contract` instances for all four
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
- `hooks/useDepartmentOfficials.js`: the department head plus every
  active official under a department, shaped for a `<select>`. This is
  the one place that logic lives, every dropdown that lets you pick an
  official (registering a project, reassigning one) reads from it, so
  there's a single source of truth instead of each form doing its own
  thing.
- `hooks/useOfficialHistory.js`: builds a public profile's activity
  feed straight from on chain event logs, see the contracts section
  above for which events carry which indexed address.
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
  official, citizen, tender vendor, and the relayer.
- `deploy.sh`: deploys all four contracts to whatever chain is at
  `$RPC_URL` (defaults to local anvil), funds the reporting treasury,
  seeds a demo dataset (four departments, a project and tender in
  each, a few citizen reports including one already gas-sponsored),
  then writes `frontend/.env.local` and syncs the compiled ABIs into
  `frontend/src/lib/generated`.
- `start-relayer.sh`: runs the local gas relayer (`relayer/server.mjs`)
  in the foreground, so citizen reports get sponsored. Needs
  `deploy.sh` to have already run.
- `dev.sh`: starts the frontend dev server.
- `run-local.sh`: does all of the above in one command, starting anvil
  and the relayer in the background and cleaning them up when you stop
  the script.

## Running it locally

You said you already have `foundryup` (forge/anvil/cast), MetaMask,
and are on Fedora, so:

```bash
cd govledger
./scripts/setup.sh      # one time: installs contract + frontend + relayer deps
./scripts/run-local.sh  # starts anvil, deploys + seeds, starts the relayer, starts the frontend
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Every demo account (department heads, officials, the citizen, and the
tender vendors) is derived from anvil's own default test mnemonic
(`test test test test test test test test test test test junk`), so
the private keys are exactly the ones anvil itself prints on startup
for accounts 0 through 13:

| Account | Role |
| --- | --- |
| 0 | Super admin |
| 1 / 2 | Infrastructure department head / official |
| 3 / 4 | Health department head / official |
| 5 / 6 | Education department head / official |
| 7 / 8 | Water Supply department head / official |
| 9 | Ordinary citizen (no role, no ETH needed to report) |
| 10 / 11 / 12 | Vendors that bid on tenders (no role) |
| 13 | Relayer (`./scripts/start-relayer.sh` uses this automatically) |

Import any of them into MetaMask (MetaMask -> Account menu -> Import
account -> paste private key) to try that role. `deploy.sh` also
prints this table after seeding.

- Import **account 9** (citizen) or a fresh, non-listed account to
  browse as an ordinary member of the public. You can read everything,
  file a report (MetaMask will ask for a signature, not a
  transaction, so it works even if this account has 0 ETH), and bid on
  open tenders (bidding still costs gas, since a vendor bidding on a
  contract is expected to have a funded wallet). You won't see an
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
to keep anvil's or the relayer's logs visible, or restart just the
frontend):

```bash
# terminal 1
./scripts/start-chain.sh

# terminal 2, once anvil is running
./scripts/deploy.sh
./scripts/start-relayer.sh

# terminal 3
./scripts/dev.sh
```

If the relayer isn't running, everything else still works, citizen
reports will just show an error until you start it (or import a
funded account and it'll fall back to nothing, since the report form
always uses the sponsored path; start the relayer to file one).

Re-running `./scripts/deploy.sh` deploys fresh contracts and reseeds
demo data, which is also a quick way to reset the demo to a clean
state.

## Running the contract tests

```bash
cd contracts
forge test -vv
```

46 tests cover all four contracts: permission checks (who can create
a department, add an official, deactivate an official, create a
project, record spending, publish a tender), budget enforcement
(spending can't exceed the allocated budget), the milestone/status
flows, department-scoped project/tender indexing, the citizen-report
triage workflow, the full tender lifecycle (anyone can bid, bidding
closes on deadline or by an official, awarding requires bidding to be
closed first, only an authorized official can close or award,
cancellation rules), the EIP-712 gasless report signature (valid
signature accepted, replay rejected, a forged "signed by someone else"
report rejected), and ReportingTreasury (funding, relayer
reimbursement, invalid signatures still revert, refunds never exceed
the available balance).

## Adding a new module

`Tender.sol` and `ReportingTreasury.sol` are both working examples of
exactly this: each depends only on the specific thing it actually
needs (`IGovRegistry`, or just `ProjectLedger`), and was wired in
without changing any of the other contracts. Say you now want a
"Document Registry" module for attaching official records to a
project. You would follow the same pattern:

1. Write `DocumentRegistry.sol`, constructed with the GovRegistry
   address, same as `ProjectLedger.sol` and `Tender.sol` are.
2. Use `registry.isAuthorizedForDepartment(msg.sender, departmentId)`
   for your write checks (or leave a function open to everyone, like
   `fileCitizenReport` and `submitBid` do, if that fits the feature).
   If you want it addressable by an official's history the way
   projects, tenders, and reports already are, index the relevant
   address in your events, see the "indexed for the officials
   registry" note in the contracts section above.
3. Add a deploy line for it in `contracts/script/Deploy.s.sol`.
4. Add its ABI to the `contracts` array in `scripts/sync-abi.mjs` and
   its address to `scripts/write-env.mjs` (and `configIsReady()` in
   `frontend/src/lib/config.js` if it should block the app from
   loading until deployed, the way the other four do).
5. Add a `getWriteDocumentRegistry` / `getReadDocumentRegistry` pair in
   `frontend/src/lib/contracts.js`.
6. Build a public page (route under `/`) and, if it needs privileged
   actions, a Portal page (route under `/portal`) the same way
   `Tenders.jsx`/`TenderDetail.jsx` and `PortalTenders.jsx` were built,
   then add the routes in `App.jsx` and a link in `PortalSubNav.jsx`
   and/or `Header.jsx`.

Nothing in GovRegistry, ProjectLedger, Tender, or ReportingTreasury
needs to change.

## Moving beyond the prototype

Things that are intentionally simplified for a prototype, and what
you'd revisit before going further:

- **Currency units.** Budgets and spending are stored as plain
  `uint256` amounts formatted with 18 decimals for convenience (the
  same scale as ETH), not tied to any real token. If you want the
  ledger to track an actual stablecoin or a custodial payment flow,
  that's a different design (an ERC20 transfer alongside the record,
  or an off chain payment reconciled against the on chain record).
- **Gasless reporting has no spam resistance, and free is easier to
  abuse than "costs a little gas".** `fileCitizenReportBySignature` is
  open to anyone, no rate limit, no bond, and the relayer will sponsor
  any validly signed report until the treasury runs dry. A real
  deployment would want per-address rate limiting (in the relayer, or
  on chain via a cooldown keyed off `reportNonces`), and probably a
  cap on how much of the treasury a single address can draw down. The
  status lifecycle (Open/UnderReview/Resolved/Dismissed) is real, the
  anti-spam layer on top of it is the piece intentionally left out.
- **The relayer is a single, trusted-for-liveness process.** It holds
  its own funded key and is the only relayer running by default. It
  cannot forge a report (the signature is what authenticates the
  reporter, the relayer only pays gas), but if it's offline, gasless
  reporting stops working until it's restarted. A real deployment
  would run several relayers, possibly operated by different parties,
  behind a queue.
- **Sign-in sessions are per-tab and per-chain, not shared across
  devices.** That's normal for a SIWE-style flow with no backend. If
  you later add a server (for notifications, off chain indexing, etc.)
  you'd exchange that signature for a proper server-side session
  instead of only keeping it in `sessionStorage`.
- **Official history is read live from event logs, with no cache.**
  `useOfficialHistory` re-queries every relevant event on every visit
  to a profile page. Fine at this scale; a real deployment with years
  of history would want a proper indexer (a subgraph, or a small
  off-chain database kept in sync by listening to the same events)
  instead of `queryFilter` over the full chain history on every page
  load.
- **No document/evidence storage.** `evidenceURI` on a milestone is
  just a string. In practice you'd pin evidence (photos, reports,
  receipts) to IPFS or Arweave and store the resulting URI here.
- **Deploying beyond a local chain.** To move from anvil to a public
  testnet (Sepolia, etc.), you only need to change `RPC_URL` and use a
  real funded deployer key (get testnet ETH from a faucet), then run
  `scripts/deploy.sh` with `RPC_URL` and `CHAIN_ID` set accordingly.
  The contracts themselves don't change. The relayer would need its
  own funded key on that network too, and probably a process manager
  instead of `npm start` in a terminal.
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
  it's not visible as an issue while running locally. The relayer
  would also need to move from `localhost:8787` to a real hosted URL
  (`VITE_RELAYER_URL`) reachable from wherever the frontend ends up.
