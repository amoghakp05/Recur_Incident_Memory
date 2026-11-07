# Recur Live Demo Walkthrough (2-Minute Script)

This script is structured for live demonstration and screen recordings. It follows the precise narrative flow showing the real-world value of organizational incident memory.

---

### Step 1: The Hook (0:00 - 0:25)
> *"It's 3 AM. A critical alert fires on the checkout service. Customers are hitting 504 Gateway Timeouts, latency is surging, and the engineer who diagnosed and solved this exact issue four months ago has left the company. What do you do?"*

- **Action in App**:
  - Open Recur dashboard at `http://localhost:8000`.
  - Notice the master-detail incident workspace. Click **"New"** or open the **Command Palette (⌘K)**.
  - Select **"Load Sample Incident (6 Demos)"** → Click **`DEMO-001`**: *"3 AM checkout latency spike and 504 Gateway Timeout"*.

---

### Step 2: The Baseline Failure — Memory Off (0:25 - 0:50)
> *"Without institutional memory, an on-call engineer or a generic AI chatbot starts completely from scratch. Let's see what happens when memory is disabled."*

- **Action in App**:
  - On the top right of the Analysis tab, toggle the segmented control to **"Memory: Off"**.
  - Show the output:
    - **Confidence**: Restrained to ~40%.
    - **Estimated Resolution Time**: ~85 minutes.
    - **Diagnosis**: Generic suggestions (e.g. "Investigate network connectivity, restart pods, verify credentials").
    - **Precedents**: Zero past incidents cited.

---

### Step 3: The Innovation Edge — Side-by-Side Compare (0:50 - 1:25)
> *"Now let's switch to Compare mode to see the power of Recur backed by Hindsight Cloud."*

- **Action in App**:
  - Toggle segmented control to **"Compare"**.
  - Highlight the **Summary Difference Bar**:
    - **Confidence**: Jumps from ~40% to **92%+** (+52% increase).
    - **Estimated Resolution Time**: Drops from ~85 min to **~14 min** (over an hour faster).
  - Walk through the **With Memory** column:
    1. **Exact Past Citations**: Points out `INC-001` / `INC-014` with semantic similarity scores.
    2. **The "Avoid" Panel**: Showcases previously failed fixes:
       - ✗ *"Do not restart payments-api pods — Restarting pods flooded postgres with 500 new connection handshakes simultaneously, causing DB CPU to hit 100%."*
    3. **Targeted Fix Steps**: Gives the exact sequence that previously worked (killing blocking PIDs and increasing pgbouncer default pool size).

---

### Step 4: Resolution & Retaining New Memory (1:25 - 1:45)
> *"The engineer checks the boxes for what worked, marks what was avoided, and resolves the incident."*

- **Action in App**:
  - Click **"Worked"** on step 1 & 2.
  - Click **"Resolve & Save to Memory"**.
  - Enter `14` minutes and submit.
  - Show the toast: `✓ Saved to memory: Incident DEMO-001 resolved in 14 min`.
  - Navigate to the **Memory** tab on the left sidebar:
    - Show the updated **Retained Incidents Ledger**.
    - Show the **Memory Activity Log** on the right with the live `RETAIN` event, latency (e.g. `1200ms`), and timestamp.

---

### Step 5: Proof of Learning — The Insights Screen (1:45 - 2:00)
> *"Every incident makes the next one faster. Let's look at the institutional impact."*

- **Action in App**:
  - Click **"Insights"** on the left sidebar.
  - Show the **MTTR Reduction vs. Agent Confidence** line chart:
    - Initial resolution time: **~90 min**.
    - Current resolution time: **~12 min** (an 85%+ improvement).
    - Confidence steadily climbing from 42% to 94%.
  - Point out the **Recurring Root-Cause Families** bar chart and the **Synthesized Architectural Patterns** synthesized by Hindsight's `reflect` capability.
  - **Closing Statement**:
    > *"Recur turns ephemeral tribal knowledge into permanent organizational muscle. Every incident makes the next one faster."*
