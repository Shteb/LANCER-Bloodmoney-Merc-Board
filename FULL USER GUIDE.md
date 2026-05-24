# LANCER Bloodmoney Merc Board — Full User Guide

Your in-depth guide for the LANCER Bloodmoney Merc Board terminal-styled web application. This application provides a mercenary company management system with separate **User (Client)** and **Admin** interfaces.

---

## Table of Contents

### User Guide
1. [Accessing the System](#accessing-the-system)
2. [Overview Dashboard](#overview-dashboard)
3. [Job Board](#job-board)
4. [Base Management](#base-management)
5. [Faction Relations](#faction-relations)
6. [Financial Records](#financial-records)
7. [Pilot List](#pilot-list)
8. [Reserves Management](#reserves-management)
9. [Shop](#shop)

### Admin Guide
10. [Admin Panel Overview](#admin-panel-overview)
11. [Overview Config](#overview-config)
12. [Transaction Management](#transaction-management)
13. [Job Board Config](#job-board-config)
14. [Vote Config](#vote-config)
15. [Faction Config](#faction-config)
16. [Base Config](#base-config)
17. [Pilot Config](#pilot-config)
18. [Shop & Reserves Config](#shop--reserves-config)

---

# USER

The User (Client) interface provides players with a terminal-styled view of their mercenary company's operations.

---

## Accessing the System

The landing page presents a terminal-style access portal where you enter your authentication code.

### How to Log In

1. Navigate to the application URL in your browser.
2. You will see a terminal-style portal with the heading and an access code input field.
3. Type your **Client password** (default: `IMHOTEP`) into the input field.
   - Passwords are case-sensitive and alphanumeric only.
4. Click **[AUTHENTICATE]** or press Enter.
5. If successful, you will be redirected to the Overview Dashboard.

> **Note:** If you see "INVALID CODE", double-check your password. If you see "UNAUTHORIZED", your session may have expired — simply re-enter your code.

### How to Log Out

- Click the **[LOGOUT]** link in the top-left corner of any page.
- Your session will be ended and you'll return to the landing page.

---

## Overview Dashboard

The Overview is your central hub displaying key company information and navigation to all other sections.

### What You'll See

- **Portal Heading** — The company/operation name
- **User Group** — Your team identifier
- **Current Balance** — Total Manna (currency) with icon
- **Galactic Position** — Your company's current location
- **Operation Progress** — A 3-segment progress bar showing mission advancement (0–3)
- **Recent Transactions** — The last 5 financial transactions showing amount, description, and related pilots

### Available Actions

| Action | Description |
|--------|-------------|
| **[JOB_BOARD]** | Navigate to active job listings |
| **[FACTION_RELATIONS]** | View faction standings and history |
| **[BASE_MANAGEMENT]** | Manage base facilities and upgrades |
| **[PILOT_LIST]** | View and manage pilot roster |
| **[RESERVES]** | Manage pilot equipment reserves |
| **[SHOP]** | Purchase reserves and resupply items |
| **[FULL_TRANSACTION_HISTORY]** | View complete financial records |

---

## Job Board

The Job Board displays all currently active missions available to your company.

### What You'll See

- **Available Missions Count** — Number of active jobs
- **Job Cards** displaying:
  - Faction emblem (if assigned)
  - Job name and rank (1–3 stars: ★☆☆, ★★☆, ★★★)
  - Client faction name (or "FIELD_NULL" if unassigned)
  - Job type and objective description
  - Client brief with additional context
  - Payment amount in Manna currency
  - Additional pay details (if any)

### Voting on Jobs

When a **Voting Period** is active, a banner appears at the top of the Job Board showing:
- Time remaining until voting closes
- Total votes cast so far
- Active pilots who haven't voted yet

**How to Cast a Vote:**

1. During an active voting period, job cards become **clickable**.
2. Click on the job card you want to vote for.
3. A **Voting Modal** appears showing all available pilots.
   - Active pilots are listed first; inactive pilots appear faded.
4. Select the pilot(s) casting their vote for this job.
5. Click **[CONFIRM]** to submit the vote.

> **Note:** Each pilot can only vote for one job per voting period. Voting for a different job automatically removes the pilot's previous vote.

### Job History

Below the active jobs, a **Global Job History** section allows you to review past missions:

1. Use the **search bar** to filter by name, faction, description, or pilot.
2. Click **filter pills** to view jobs by state: [ALL], [ACTIVE], [COMPLETE], [FAILED], [IGNORED].
3. Toggle **[ACTIVE PILOTS]** to filter history by currently active pilots only.
4. Click any job entry to view its full details in a modal.

---

## Base Management

The Base Management page lets you view and purchase facilities and upgrades for your company's base of operations.

### Facility Types

| Type | Slots |
|------|-------|
| **Core** | 3 |
| **Major** | 6 |
| **Minor** | 6 |

### What You'll See

Each facility card displays:
- Facility name and description
- Purchase status (active/inactive)
- Available upgrades with prices and purchase limits (e.g., "2/4")

### How to Purchase a Facility

1. Find an unpurchased Major facility card.
2. Click the **[PURCHASE]** button.
3. A purchase modal opens showing:
   - Facility details and price
   - Pilot selection checkboxes for expense splitting
   - Calculated cost per pilot
   - Balance warnings if funds are insufficient
4. Select which pilots will cover the expense. The cost will be evenly distributed across selected pilots.
5. Click **[PURCHASE]** to confirm.

### How to Purchase an Upgrade

1. Find an available upgrade on a purchased facility.
2. Click the **[PURCHASE]** button next to the upgrade.
3. Follow the same purchase modal process as facilities.
4. The upgrade counter increments (up to the maximum allowed).

### Managing Minor Facility Slots

| Action | How To |
|--------|--------|
| **Unlock Slot** | Click **[UNLOCK]** on a disabled slot (slots 5–6 start disabled) |
| **Construct Facility** | Click **[CONSTRUCT_FACILITY]** on an empty enabled slot, then select from available options |
| **Demolish Facility** | Click **[DEMOLISH]** on a built facility, then confirm in the modal |

---

## Faction Relations

The Faction Relations page shows all known factions and your company's standing with each.

### What You'll See

- **Faction Cards** displaying:
  - Faction emblem
  - Faction title
  - Standing level with color coding:
    - **0 — Distrusted**
    - **1 — Wary**
    - **2 — Neutral**
    - **3 — Respected**
    - **4 — Trusted**
  - Jobs Completed count
  - Jobs Failed count
  - Faction brief/description

### How to View Faction Job History

1. Click the **[VIEW_JOB_HISTORY]** button on any faction card.
2. A modal opens showing all jobs associated with that faction.
3. Jobs are displayed with their current state (Active, Complete, Failed, Ignored).
4. Click any job in the list to view its full details.

---

## Financial Records

The Finances page provides a complete view of all company transactions.

### What You'll See

- **Current Balance** — Total Manna with currency icon
- **Full Transaction Table** showing:
  - Date and time (DD/MM HH:MM format)
  - Amount (color-coded: green for income, red for expenses)
  - Description
  - Related pilot callsigns
  - Running cumulative balance

### How to Use

- Scroll through the complete transaction history.
- Transactions are listed in reverse chronological order (newest first).
- Use this page to audit income, expenses, and pilot-specific charges.

---

## Pilot List

The Pilot List displays all registered pilots in your company roster.

### What You'll See

- **Pilot Cards** showing:
  - Pilot name and callsign
  - License Level (LL 0–12)
  - Active/Inactive status badge
  - Personal balance with currency icon
  - Notes field
  - Personal operation progress bar (if the Admin has enabled Open-table mode)

> Active pilots are displayed first; inactive pilots appear faded and sorted below.

### Available Actions

| Action | How To |
|--------|--------|
| **Search Pilots** | Use the search bar to filter by name, callsign, or license level |
| **Edit Notes** | Click **[EDIT_NOTES]** → modify text in modal → click **[SAVE]** |
| **View Balance History** | Click **[BALANCE_HISTORY]** to see pilot-specific transactions |
| **View Job History** | Click **[JOB_HISTORY]** to see pilot's Active, Complete, and Failed jobs |

---

## Reserves Management

The Reserves page provides a unified interface for managing all pilot equipment reserves.

### What You'll See

- **Reserve Cards grouped by Pilot** showing:
  - Pilot name, callsign, and license level
  - Each reserve item with:
    - Rank indicator (R1, R2, R3)
    - Reserve name and description
    - Deployment status with color coding:
      - **In Reserve** — Available for deployment
      - **Deployed** — Currently in use on the current job
      - **Expended** — Used up, no longer available. At this point, feel free to delete the reserve if it cannot be recovered.

### How to Cycle Deployment Status

1. Click the **[CYCLE]** button on any reserve card.
2. Status cycles through: **In Reserve → Deployed → Expended → In Reserve**

### How to Transfer a Reserve

1. Click on a reserve card to **select** it (highlighted with color inversion).
2. Click the **[TRANSFER_RESERVE]** button.
3. A modal appears listing all pilots (active first).
4. Select the target pilot to receive the reserve.
5. Click **[TRANSFER]** to confirm.
6. The reserve moves to the target pilot, keeping its current deployment status.

### How to Remove a Reserve

1. Click on a reserve card to **select** it.
2. Click the **[TRASH_RESERVE]** button.
3. A confirmation modal appears showing the reserve details.
4. Click **[CONFIRM_TRASH]** to permanently remove the reserve.

> **Warning:** Removing a reserve is irreversible.

---

## Shop

The Shop allows players to purchase reserve items and resupply resources.

### What You'll See

- **Resupply Items**:
  - Limited Restock — limited weapon/system recharge
  - Repair Point — additional repair capability
  - Core Battery — core power recharge

- **Reserve Stock** — Available equipment for purchase:
  - Rank indicator (R1, R2, R3)
  - Item name and description
  - Price in Manna currency

### How to Make a Purchase

1. Click on any reserve card or resupply item.
2. The **Purchase Modal** opens with two sections:

**Expense To (Who Pays):**

3. Check the pilots who will share the cost.
4. The cost is divided equally among selected pilots.
5. A warning appears if any selected pilot has insufficient funds.

**Assign To (Who Receives):**

6. Select the pilot who will receive the item.
7. For reserves: the item is added to the assignee's reserve list.
8. For resupply items: no assignment is needed. It is recommended you note down or make the change immediately on the character sheet taking the resupply. The purchase history will still track that the purchase occured.

9. Click **[PURCHASE]** to complete the transaction.
10. The transaction is created, balances are deducted, and the item is assigned.

> **Tip:** The expense pilots and assignee pilots can be different. For example, the whole team can split the cost of a reserve that goes to one pilot.

---

# ADMIN

The Admin interface provides comprehensive control over all game data, settings, and operations. Access it by logging in with the Admin password (default: `TARASQUE`).

---

## Admin Panel Overview

The Admin panel uses a tabbed interface with the following tabs:

| Tab | Purpose |
|-----|---------|
| **Overview Config** | Global settings and display configuration |
| **Transaction Management** | Manna balance and transaction CRUD |
| **Job Board Config** | Create, edit, and manage job postings |
| **Vote Config** | Manage voting periods for job selection |
| **Faction Config** | Create and manage factions |
| **Base Config** | Configure facilities and cost modifiers |
| **Pilot Config** | Manage pilot roster and associations |
| **Shop & Reserves Config** | Configure store inventory and reserves |

---

## Overview Config

The Overview Config tab manages global application settings that affect both the Client and Admin views.

### Settings Available

| Setting | Description | Constraints |
|---------|-------------|-------------|
| **Portal Heading** | Title on landing page and client header | Max 100 characters |
| **Color Scheme** | Terminal theme | Grey, Orange, Green, or Blue |
| **UNT (Galactic Date)** | Current in-game date | DD/MM/YYYY format |
| **Galactic Position** | Fleet location text | Free text |
| **User Group** | Team identifier | Max 100 characters |
| **Operation Progress** | Global progress level | 0–3 (Initial → Critical) |
| **Client Password** | User access code | Alphanumeric only |
| **Admin Password** | Admin access code | Alphanumeric only |
| **Open Table Mode** | Show personal progress bars | Toggle on/off |
| **Currency Icon** | Icon displayed with Manna values | Select from emblem library |

### How to Update Settings

1. Navigate to the **Overview Config** tab.
2. Modify any settings fields as needed.
3. Click **[SAVE SETTINGS]** to apply all changes.
4. Changes take effect immediately for all connected users.
5. Password changes only affect new logins (existing sessions remain valid).

---

## Transaction Management

The Transaction Management tab controls the company's Manna (currency) system.

### What You'll See

- **Active Balance** — Sum of all **active** pilot balances
- **Total Balance** — Overall Manna balance of **all** pilots
- **Transaction History** — Complete list of all transactions

### How to Add a Transaction

1. Navigate to the **Transaction Management** tab.
2. In the "Add Transaction" section:
   - Enter the **Amount** (positive for income, negative for expense).
   - Enter a **Description** for the transaction.
   - Select which **pilots** are affected (individual selection or all active pilots).
3. Click **[ADD TRANSACTION]**.
4. The transaction is created and broadcast to all connected users.

> **Note:** Each selected pilot is affected by the full transaction amount. If you enter 100m and select 3 pilots, each pilot receives 100m.

### How to Filter Transactions

Use the filter options above the transaction list:
- **All** — Shows every transaction
- **Assigned** — Only transactions linked to specific pilots
- **Unassigned** — Only unlinked transactions. These do not effect balance in any way and it is recommended they be either assigned or deleted.

### How to Edit a Transaction

1. Find the transaction in the history list.
2. Click **[EDIT]** on the transaction row.
3. Modify the date, amount, or description.
4. Click **[SAVE]** to apply changes.

### How to Reassign Pilot Associations

1. Click **[SELECT PILOT(S)]** on a transaction.
2. Check or uncheck pilots to change associations.
3. Click **[SAVE]** to update.

### How to Delete a Transaction

1. Click **[DELETE]** on the transaction row.
2. Confirm the deletion in the modal.
3. The transaction is removed and balances recalculate.

---

## Job Board Config

The Job Board Config tab provides full CRUD operations for job postings and batch job management.

### How to Create a New Job

1. Navigate to the **Job Board Config** tab.
2. Fill in the "Add New Job" form:
   - **Name** — Job title
   - **Rank** — Difficulty (1–3 stars)
   - **State** — Initial state (usually Pending)
   - **Faction** — Optional faction association
   - **Job Type** — Category (e.g., Extraction, Escort)
   - **Objective** — Detailed description
   - **Client Brief** — Player-facing briefing
   - **Currency Pay** — Payment amount (e.g., "100m")
   - **Additional Pay** — Optional bonus details
   - **Admin Log** — GM-only notes (not shown to players)
   - **Emblem** — Select from the emblem grid (auto-selects faction emblem if faction chosen)
3. Click **[ADD JOB]** to create.

### Job States

| State | Description | Visible to Players |
|-------|-------------|-------------------|
| **Pending** | Queued for future activation | No |
| **Active** | Currently available on Job Board | Yes |
| **Complete** | Successfully finished | Yes (history only) |
| **Failed** | Unsuccessfully finished | Yes (history only) |
| **Ignored** | Archived/skipped | Yes (history only) |

### How to Change Job State

**Quick State Change (Active jobs only):**
- Click **[MARK COMPLETED]** (green) to set Complete
- Click **[MARK FAILED]** (red) to set Failed

**Manual State Change:**
1. Click **[EDIT]** on the job.
2. Change the State dropdown.
3. Save changes.

### How to Progress All Jobs (Batch Operation)

This action advances the entire job board:

1. Click the **[PROGRESS ALL JOBS]** button.
2. A confirmation modal shows what will happen:
   - All **Active** jobs move to **Ignored**
   - All **Pending** jobs move to **Active**
   - Newly Active jobs are added to all Active pilots' related job lists
3. Click **[CONFIRM]** to execute.

> **Warning:** This also archives any ongoing voting period. This action cannot be undone.

### How to Search and Filter Jobs

- Use the **search bar** to filter by name, faction, description, or pilot.
- Click **state filter pills** to view only jobs in a specific state.

### How to Manage Emblems

**Upload a New Emblem:**
1. Click **[UPLOAD EMBLEM]** in the emblem section.
2. Select a PNG, JPEG, or BMP file (max 10MB).
3. The image is automatically converted to SVG format.

**Delete an Emblem:**
1. Select the emblem in the grid.
2. Click **[DELETE SELECTED EMBLEM]**.
3. Confirm deletion (only works if not in use by any job or faction).

---

## Vote Config

The Vote Config tab manages voting periods where pilots can vote on their preferred next mission.

### How to Start a Voting Period

1. Navigate to the **Vote Config** tab.
2. Set an **End Time** using the datetime picker, or check **"No End Time"** for unlimited duration.
3. Review the list of Active jobs that will be included.
4. Click **[START VOTING PERIOD]**.
5. Players will now see voting UI on the Job Board.

### How to Monitor Votes

During an active voting period, you'll see:
- Time remaining (or "Infinite" if no end time)
- Each job card with its vote count
- List of pilot callsigns who voted for each job

### How to End Voting

| Action | Description |
|--------|-------------|
| **[CONCLUDE VOTE]** | Stops accepting new votes but keeps results visible to players |
| **[ARCHIVE VOTING RESULTS]** | Moves concluded period to the Vote Archive |

### How to Modify Voting End Time

1. Click **[MODIFY VOTING CLOSE]**.
2. Enter a new end time or check "No End Time".
3. Click **[UPDATE END TIME]** to save.

### Vote Archive

- All past voting periods are stored in the archive.
- Each shows job vote counts, pilot names, and end times.
- Click **[DELETE VOTE LOG]** to remove archived periods.

---

## Faction Config

The Faction Config tab manages factions and their relationships with your company.

### How to Create a New Faction

1. Navigate to the **Faction Config** tab.
2. Fill in the form:
   - **Faction Title** — Name of the faction
   - **Brief** — Description/lore text
   - **Standing** — Relationship level (0–4)
   - **Jobs Completed Offset** — Manual adjustment to completed count
   - **Jobs Failed Offset** — Manual adjustment to failed count
   - **Admin Log** — GM-only notes
   - **Emblem** — Select from the grid
3. Click **[ADD FACTION]** to create.

### Standing Levels

| Value | Label |
|-------|-------|
| 0 | Distrusted |
| 1 | Wary |
| 2 | Neutral |
| 3 | Respected |
| 4 | Trusted |

### How to View Faction-Related Jobs

1. Click **[RELATED JOBS]** on a faction card.
2. A modal shows all jobs linked to that faction via their factionId.
3. Jobs are listed with name, state, and assigned pilots.

### How to Edit or Delete a Faction

- **Edit:** Click **[EDIT]** → modify fields → **[SAVE]**
- **Delete:** Click **[DELETE]** → confirm in modal

> **Note:** Job counts are dynamically calculated from actual job data + offset values. The offset allows manual adjustments for off-screen history.

---

## Base Config

The Base Config tab manages the company's base facilities, upgrades, and pricing.

### Facility Cost Modifier

The **Facility Cost Modifier** adjusts all facility-related prices globally:

1. Set the percentage value (-100% to +300%).
2. Click **[UPDATE]** to apply.
3. All prices throughout the application update immediately.

> **Guidance:** Base prices are tuned for 4 players. Add or subtract ~20% per extra or missing player.

### Managing Core Facilities (3 slots)

Core facilities are always active. You can manage their upgrades:
- View upgrade name, price, and current/max purchase counts.
- Adjust the **Upgrade Count** input to set purchased level.

### Managing Major Facilities (6 slots)

- **Toggle Purchase Status:** Check/uncheck the purchased checkbox.
- **Manage Upgrades:** Same as Core facilities.

### Managing Minor Facility Slots (6 slots)

| Action | How To |
|--------|--------|
| **Enable/Disable Slot** | Toggle the Enable checkbox (slots 5–6 start disabled) |
| **Assign Facility** | Click **[ASSIGN]** → select from available facilities |
| **Clear Slot** | Click **[CLEAR]** to remove assigned facility |

---

## Pilot Config

The Pilot Config tab provides full management of the pilot roster.

### How to Add a New Pilot

1. Navigate to the **Pilot Config** tab.
2. Fill in the form:
   - **Name** — Full pilot name
   - **Callsign** — In-game callsign
   - **License Level** — 0–12
   - **Notes** — Optional multiline text
   - **Admin Log** — GM-only notes
   - **Personal Operation Progress** — 0–3 (only visible if Open Table mode is on)
   - **Active** — Check to set as active
3. Click **[ADD PILOT]** to create.

### How to Manage Pilot Associations

**Related Jobs:**
1. Click **[RELATED JOBS]** on a pilot.
2. A modal shows non-Pending jobs available to associate.
3. Check/uncheck jobs to modify associations.
4. Click **[SAVE]**.

**Balance History:**
1. Click **[BALANCE HISTORY]** on a pilot.
2. View all transactions affecting this pilot.
3. Uncheck transactions to disassociate them.
4. Click **[SAVE]** to update.

**Reserves:**
1. Click **[EDIT RESERVES]** on a pilot.
2. A modal shows all reserves owned by this pilot with status.
3. Available actions:
   - Change status: **In Reserve / Deployed / Expended**
   - **Add Reserve** — Opens sub-modal to add from available stock
   - **Remove Reserve** — Removes from pilot's inventory
4. Changes save automatically.

### Batch Operation: Progress Operation Track

If **Open Table** mode is enabled:
1. Click **[PROGRESS OPERATION TRACK]**.
2. Review affected pilots in the confirmation modal.
3. Click **[CONFIRM]** to increment all active pilots' Personal Operation Progress.
4. Progress cycles: 0 → 1 → 2 → 3 → 0.

### How to Delete a Pilot

1. Click **[DELETE]** on the pilot card.
2. Confirm in the modal.
3. The pilot and all their associations are removed.

---

## Shop & Reserves Config

The Shop & Reserves Config tab manages the store inventory and available reserve items.

### Resupply Items

Configure the three fixed resupply items:

| Item | Description |
|------|-------------|
| **Limited Restock** | Limited weapon/system charge recovery |
| **Repair Point** | Additional repair capability |
| **Core Battery** | Core power recharge |

For each item:
1. Set the **Price** (numeric value).
2. Toggle **Enabled** to make available/unavailable in shop.

### Managing Reserve Inventory

**Create a New Reserve:**
1. Click **[CREATE RESERVE]**.
2. Fill in: Rank (1–3), Name, Price, Description, Admin Log.
3. Click **[SAVE]** to create.

**Edit a Reserve:**
1. Click a reserve card to select it.
2. Click **[EDIT SELECTED]**.
3. Modify fields as needed.
4. Click **[SAVE]**.

**Delete a Reserve:**
1. Select the reserve card.
2. Click **[DELETE SELECTED]**.
3. Confirm deletion (only works if not assigned to any pilot or in stock).

### Managing Store Stock (What's for Sale)

**Add Reserves to Stock:**
1. Select reserve cards in the "Available Reserves" section.
2. Click **[ADD SELECTED TO STOCK]** to make them available for purchase.

**Add Random Reserves:**
1. Click **[ADD RANDOM RESERVE]** to randomly add reserves to stock based on rank visibility settings.

**Remove from Stock:**
1. Select reserve cards in the "In-Store" section.
2. Click **[REMOVE SELECTED]** to take them off the shelf.

### Filtering Reserves

- Click **rank filter pills** (R1, R2, R3) to filter by rank.
- Use the **search bar** to filter by name.
- Toggle **"Hide Default Reserves"** to show only custom reserves.

---

## Tips & Common Workflows

### Starting a New Operation (GM Workflow)

1. **Create jobs** in Pending state via Job Board Config.
2. **Set up factions** with appropriate standings.
3. **Progress All Jobs** to activate Pending jobs.
4. **Start a Voting Period** to let pilots choose their mission.
5. After voting concludes, **archive results** and assign the mission.

### Managing Currency Flow

1. Add positive transactions for mission completion rewards.
2. Use pilot-specific expenses for individual purchases.
3. Use the Facility Cost Modifier to balance economy for group size.

### Between-Session Checklist

1. Update **UNT date** in Overview Config.
2. Progress **Operation Track** if appropriate.
3. Mark completed/failed jobs and progress the board.
4. Update faction standings based on mission outcomes.
5. Restock the shop to your taste.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't log in | Verify password is correct (case-sensitive, alphanumeric) |
| Changes not appearing | Check SSE connection — refresh page if status shows disconnected |
| Purchase fails | Ensure sufficient balance for all expense pilots |
| Can't delete emblem | Emblem is in use by a job or faction — remove assignments first |
| Can't delete reserve | Reserve is assigned to a pilot or in store stock — remove first |
| Voting not showing | Ensure a voting period is active and has not expired |
