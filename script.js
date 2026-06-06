const STORAGE_KEY = "hiltonFreeNightTrackersV4";

const defaultTrackers = [
  {
    id: "shane-aspire",
    name: "Shane’s Hilton Aspire",
    goal: 60000,
    accountIds: ["41008", "41016"],
    transactions: [],
    expanded: false
  },
  {
    id: "shane-surpass",
    name: "Shane’s Hilton Surpass",
    goal: 15000,
    accountIds: ["22005", "72011"],
    transactions: [],
    expanded: false
  },
  {
    id: "diana-surpass",
    name: "Diana’s Hilton Surpass",
    goal: 15000,
    accountIds: ["71005", "21031"],
    transactions: [],
    expanded: false
  }
];

let trackers = loadTrackers();

function loadTrackers() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultTrackers);

  try {
    const parsed = JSON.parse(saved);
    return defaultTrackers.map(defaultTracker => {
      const savedTracker = parsed.find(item => item.id === defaultTracker.id);
      return {
        ...defaultTracker,
        transactions: savedTracker?.transactions || [],
        expanded: savedTracker?.expanded || false
      };
    });
  } catch {
    return structuredClone(defaultTrackers);
  }
}

function saveTrackers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trackers));
}

function formatMoney(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function normalizeAccount(value) {
  return String(value || "").replace(/[^0-9]/g, "").slice(-5);
}

function normalizeAmount(value) {
  if (typeof value === "number") return value;
  const clean = String(value || "")
    .replace(/[$,]/g, "")
    .replace(/[()]/g, "-")
    .trim();
  const amount = Number.parseFloat(clean);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function normalizeHeader(header) {
  return String(header || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function makeTransactionKey(transaction) {
  return [
    normalizeAccount(transaction.account),
    String(transaction.date || "").trim().toLowerCase(),
    String(transaction.description || "").trim().toLowerCase().replace(/\s+/g, " "),
    Number(transaction.amount || 0).toFixed(2)
  ].join("|");
}

function getExistingKeys() {
  const keys = new Set();
  trackers.forEach(tracker => {
    tracker.transactions.forEach(transaction => keys.add(makeTransactionKey(transaction)));
  });
  return keys;
}

function findTrackerByAccount(account) {
  const normalized = normalizeAccount(account);
  return trackers.find(tracker => tracker.accountIds.includes(normalized));
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      current.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      current.push(value);
      if (current.some(cell => String(cell).trim() !== "")) rows.push(current);
      current = [];
      value = "";
    } else {
      value += char;
    }
  }

  current.push(value);
  if (current.some(cell => String(cell).trim() !== "")) rows.push(current);
  return rows;
}

function detectColumns(headers) {
  const normalized = headers.map(normalizeHeader);

  const findIndex = candidates => normalized.findIndex(header =>
    candidates.some(candidate => header.includes(candidate))
  );

  return {
    date: findIndex(["date", "transactiondate", "posteddate"]),
    description: findIndex(["description", "merchant", "name", "details"]),
    amount: findIndex(["amount", "debit", "charge", "extendedamount"]),
    account: findIndex(["account", "card", "accountnumber", "last5", "lastfive"])
  };
}

function rowToTransaction(row, columns, fallbackAccount) {
  const account = columns.account >= 0 ? row[columns.account] : fallbackAccount;
  const date = columns.date >= 0 ? row[columns.date] : "";
  const description = columns.description >= 0 ? row[columns.description] : "Imported Transaction";
  const amount = columns.amount >= 0 ? normalizeAmount(row[columns.amount]) : 0;

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    account: normalizeAccount(account),
    date: String(date || "").trim(),
    description: String(description || "Imported Transaction").trim(),
    amount,
    importedAt: new Date().toISOString()
  };
}

function guessAccountFromText(text) {
  const allAccounts = trackers.flatMap(tracker => tracker.accountIds);
  return allAccounts.find(account => text.includes(account)) || "";
}

function importCSV() {
  const input = document.getElementById("csvFile");
  const status = document.getElementById("importStatus");
  const file = input.files[0];

  if (!file) {
    status.textContent = "Choose a CSV file first.";
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    const text = event.target.result;
    const rows = parseCSV(text);

    if (rows.length < 2) {
      status.textContent = "No transactions found in that CSV.";
      return;
    }

    const headers = rows[0];
    const columns = detectColumns(headers);
    const fallbackAccount = guessAccountFromText(text);
    const existingKeys = getExistingKeys();

    let imported = 0;
    let duplicates = 0;
    let skipped = 0;
    let unknownAccounts = new Set();

    rows.slice(1).forEach(row => {
      const transaction = rowToTransaction(row, columns, fallbackAccount);

      if (!transaction.amount || !transaction.account) {
        skipped++;
        return;
      }

      const tracker = findTrackerByAccount(transaction.account);
      if (!tracker) {
        unknownAccounts.add(transaction.account);
        skipped++;
        return;
      }

      const key = makeTransactionKey(transaction);
      if (existingKeys.has(key)) {
        duplicates++;
        return;
      }

      tracker.transactions.push(transaction);
      existingKeys.add(key);
      imported++;
    });

    trackers.forEach(tracker => {
      tracker.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    saveTrackers();
    renderTrackers();
    input.value = "";

    const unknownMessage = unknownAccounts.size
      ? ` Unknown account(s): ${Array.from(unknownAccounts).join(", ")}.`
      : "";

    status.textContent = `Imported ${imported} transaction(s). Skipped ${duplicates} duplicate(s) and ${skipped} unmatched row(s).${unknownMessage}`;
  };

  reader.readAsText(file);
}

function toggleTransactions(trackerId) {
  const tracker = trackers.find(item => item.id === trackerId);
  tracker.expanded = !tracker.expanded;
  saveTrackers();
  renderTrackers();
}

function clearTrackerTransactions(trackerId) {
  const tracker = trackers.find(item => item.id === trackerId);
  if (!confirm(`Clear all transactions for ${tracker.name}?`)) return;
  tracker.transactions = [];
  saveTrackers();
  renderTrackers();
}

function clearAllTransactions() {
  if (!confirm("Clear all saved transactions from this device?")) return;
  trackers.forEach(tracker => tracker.transactions = []);
  saveTrackers();
  renderTrackers();
  document.getElementById("importStatus").textContent = "All transactions cleared.";
}

function renderTrackers() {
  const container = document.getElementById("trackers");
  container.innerHTML = "";

  trackers.forEach(tracker => {
    const total = tracker.transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const remaining = Math.max(tracker.goal - total, 0);
    const percent = Math.min((total / tracker.goal) * 100, 100);
    const accountList = tracker.accountIds.map(account => `-${account}`).join(", ");

    const card = document.createElement("article");
    card.className = "tracker-card";
    card.innerHTML = `
      <div class="tracker-header">
        <div>
          <h2>${tracker.name}</h2>
          <p class="muted">Accounts: ${accountList}</p>
        </div>
        <div class="goal-badge">Goal: ${formatMoney(tracker.goal)}</div>
      </div>

      <div class="stats">
        <div class="stat"><span>Spent</span><strong>${formatMoney(total)}</strong></div>
        <div class="stat"><span>Remaining</span><strong>${formatMoney(remaining)}</strong></div>
        <div class="stat"><span>Complete</span><strong>${percent.toFixed(1)}%</strong></div>
      </div>

      <div class="progress-shell" aria-label="Progress toward goal">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>

      <div class="transaction-tools">
        <button type="button" class="secondary" onclick="toggleTransactions('${tracker.id}')">
          ${tracker.expanded ? "Hide" : "Show"} Transactions (${tracker.transactions.length})
        </button>
        <button type="button" class="danger" onclick="clearTrackerTransactions('${tracker.id}')">Clear This Card</button>
      </div>

      <div class="transactions ${tracker.expanded ? "open" : ""}">
        ${renderTransactions(tracker.transactions)}
      </div>
    `;

    container.appendChild(card);
  });
}

function renderTransactions(transactions) {
  if (!transactions.length) return `<p class="empty">No transactions yet.</p>`;

  return transactions.map(transaction => `
    <div class="transaction">
      <div>
        <div class="transaction-title">${escapeHTML(transaction.description)}</div>
        <div class="transaction-meta">${formatDate(transaction.date)} · Account -${escapeHTML(transaction.account)}</div>
      </div>
      <div class="transaction-amount">${formatMoney(Number(transaction.amount || 0))}</div>
    </div>
  `).join("");
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

renderTrackers();
