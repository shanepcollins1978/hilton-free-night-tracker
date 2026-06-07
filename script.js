const STORAGE_KEY = "hiltonFreeNightTrackersV7";

const defaultTrackers = [
  {
    id: "shane-aspire",
    name: "Shane’s Hilton Aspire",
    goal: 60000,
    accountIds: ["-41008", "-41016"],
    transactions: [],
    expanded: false
  },
  {
    id: "shane-surpass",
    name: "Shane’s Hilton Surpass",
    goal: 15000,
    accountIds: ["-22005", "-72011"],
    transactions: [],
    expanded: false
  },
  {
    id: "diana-surpass",
    name: "Diana’s Hilton Surpass",
    goal: 15000,
    accountIds: ["-71005", "-21031"],
    transactions: [],
    expanded: false
  }
];

let trackers = loadTrackers();

document.addEventListener("DOMContentLoaded", () => {
  renderTrackers();
});

function loadTrackers() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultTrackers);

  try {
    const parsed = JSON.parse(saved);

    return defaultTrackers.map(defaultTracker => {
      const existing = parsed.find(t => t.id === defaultTracker.id);
      return {
        ...defaultTracker,
        transactions: existing?.transactions || [],
        expanded: existing?.expanded || false
      };
    });
  } catch {
    return structuredClone(defaultTrackers);
  }
}

function saveTrackers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trackers));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function normalizeAccount(value) {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return "";
  const lastFive = digits.slice(-5);
  return "-" + lastFive;
}

function parseAmount(value) {
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "-")
    .replace(/\)/g, "")
    .trim();

  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
      }
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") i++;
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

function findColumn(headers, names) {
  const lowerHeaders = headers.map(h => String(h).trim().toLowerCase());

  for (const name of names) {
    const index = lowerHeaders.findIndex(h => h === name.toLowerCase());
    if (index !== -1) return index;
  }

  for (const name of names) {
    const index = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()));
    if (index !== -1) return index;
  }

  return -1;
}

function getTransactionFromRow(headers, row) {
  const dateIndex = findColumn(headers, ["Date", "Transaction Date", "Posted Date"]);
  const descriptionIndex = findColumn(headers, ["Description", "Merchant", "Name"]);
  const amountIndex = findColumn(headers, ["Amount", "Charge", "Debit"]);
  const accountIndex = findColumn(headers, ["Account #", "Account Number", "Card Number", "Card", "Account"]);

  const date = dateIndex >= 0 ? row[dateIndex]?.trim() : "";
  const description = descriptionIndex >= 0 ? row[descriptionIndex]?.trim() : "";
  const amount = amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0;
  const accountId = accountIndex >= 0 ? normalizeAccount(row[accountIndex]) : "";

  return { date, description, amount, accountId };
}

function makeTransactionKey(transaction) {
  return [
    transaction.accountId,
    transaction.date,
    transaction.description.toLowerCase().replace(/\s+/g, " ").trim(),
    transaction.amount.toFixed(2)
  ].join("|");
}

function findTrackerByAccount(accountId) {
  return trackers.find(tracker => tracker.accountIds.includes(accountId));
}

function importCSV() {
  const fileInput = document.getElementById("csvFile");
  const status = document.getElementById("importStatus");
  const file = fileInput.files?.[0];

  if (!file) {
    status.textContent = "Please choose a CSV file first.";
    return;
  }

  const reader = new FileReader();

  reader.onload = event => {
    try {
      const text = event.target.result;
      const rows = parseCSV(text);

      if (rows.length < 2) {
        status.textContent = "No transactions found in this CSV.";
        return;
      }

      const headers = rows[0];
      let imported = 0;
      let duplicates = 0;
      let skipped = 0;

      const existingKeys = new Set(
        trackers.flatMap(tracker => tracker.transactions.map(makeTransactionKey))
      );

      rows.slice(1).forEach(row => {
        const transaction = getTransactionFromRow(headers, row);

        if (!transaction.accountId || !transaction.description || !transaction.amount) {
          skipped++;
          return;
        }

        const tracker = findTrackerByAccount(transaction.accountId);

        if (!tracker) {
          skipped++;
          return;
        }

        const key = makeTransactionKey(transaction);

        if (existingKeys.has(key)) {
          duplicates++;
          return;
        }

        tracker.transactions.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          ...transaction
        });

        existingKeys.add(key);
        imported++;
      });

      trackers.forEach(tracker => {
        tracker.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      });

      saveTrackers();
      renderTrackers();

      status.textContent = `Imported ${imported} transaction(s). Skipped ${duplicates} duplicate(s) and ${skipped} unmatched row(s).`;
      fileInput.value = "";
    } catch (error) {
      status.textContent = "Import failed. Please confirm this is an Amex CSV file.";
      console.error(error);
    }
  };

  reader.onerror = () => {
    status.textContent = "Could not read the file.";
  };

  reader.readAsText(file);
}

function clearAllTransactions() {
  if (!confirm("Clear all saved transactions from this device?")) return;

  trackers = trackers.map(tracker => ({
    ...tracker,
    transactions: []
  }));

  saveTrackers();
  renderTrackers();

  document.getElementById("importStatus").textContent = "All transactions cleared.";
}

function deleteTransaction(trackerId, transactionId) {
  const tracker = trackers.find(t => t.id === trackerId);
  if (!tracker) return;

  tracker.transactions = tracker.transactions.filter(t => t.id !== transactionId);
  saveTrackers();
  renderTrackers();
}

function toggleTracker(trackerId, expanded) {
  const tracker = trackers.find(t => t.id === trackerId);
  if (!tracker) return;

  tracker.expanded = expanded;
  saveTrackers();
}

function renderTrackers() {
  const container = document.getElementById("trackers");

  container.innerHTML = trackers.map(tracker => {
    const total = tracker.transactions.reduce((sum, t) => sum + t.amount, 0);
    const remaining = Math.max(tracker.goal - total, 0);
    const percent = Math.min((total / tracker.goal) * 100, 100);

    const transactionsHTML = tracker.transactions.length
      ? tracker.transactions.map(t => `
          <div class="transaction">
            <div class="transaction-top">
              <span>${escapeHTML(t.description)}</span>
              <span>${formatMoney(t.amount)}</span>
            </div>
            <div class="transaction-meta">
              ${escapeHTML(t.date || "No date")} · Account ${escapeHTML(t.accountId)}
            </div>
            <button type="button" class="danger" onclick="deleteTransaction('${tracker.id}', '${t.id}')">Delete</button>
          </div>
        `).join("")
      : `<p class="empty">No transactions imported yet.</p>`;

    return `
      <article class="tracker-card">
        <div class="tracker-header">
          <div>
            <h2 class="tracker-title">${tracker.name}</h2>
            <p class="account-list">Accounts: ${tracker.accountIds.join(", ")}</p>
          </div>
          <strong>${percent.toFixed(1)}%</strong>
        </div>

        <div class="progress-shell" aria-label="${tracker.name} progress">
          <div class="progress-fill" style="width: ${percent}%"></div>
        </div>

        <div class="stats-grid">
          <div class="stat">
            <div class="stat-label">Year to date</div>
            <div class="stat-value">${formatMoney(total)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Goal</div>
            <div class="stat-value">${formatMoney(tracker.goal)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Remaining</div>
            <div class="stat-value">${formatMoney(remaining)}</div>
          </div>
        </div>

        <details ${tracker.expanded ? "open" : ""} ontoggle="toggleTracker('${tracker.id}', this.open)">
          <summary>Transactions (${tracker.transactions.length})</summary>
          <div class="transaction-list">
            ${transactionsHTML}
          </div>
        </details>
      </article>
    `;
  }).join("");
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
