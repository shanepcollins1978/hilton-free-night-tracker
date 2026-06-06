const APP_VERSION = "2.0";

const TRACKERS = [
  {
    id: "shane-surpass",
    owner: "Shane",
    type: "Hilton Surpass",
    title: "Shane’s Hilton Surpass",
    goal: 15000,
    milestones: [
      { amount: 15000, label: "Free Night Certificate" }
    ]
  },
  {
    id: "diana-surpass",
    owner: "Diana",
    type: "Hilton Surpass",
    title: "Diana’s Hilton Surpass",
    goal: 15000,
    milestones: [
      { amount: 15000, label: "Free Night Certificate" }
    ]
  },
  {
    id: "shane-aspire",
    owner: "Shane",
    type: "Hilton Aspire",
    title: "Shane’s Hilton Aspire Card",
    goal: 60000,
    milestones: [
      { amount: 30000, label: "First Free Night Certificate" },
      { amount: 60000, label: "Second Free Night Certificate" }
    ]
  }
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

function key(id) {
  return `hilton-free-night-tracker-pro-${id}`;
}

function load(id) {
  return JSON.parse(localStorage.getItem(key(id)) || "[]");
}

function save(id, transactions) {
  localStorage.setItem(key(id), JSON.stringify(transactions));
}

function totalFor(id) {
  return load(id).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function pct(total, goal) {
  return Math.min(100, Math.max(0, (total / goal) * 100));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function render() {
  document.getElementById("trackingYear").textContent = new Date().getFullYear();

  const container = document.getElementById("trackers");
  container.innerHTML = "";

  TRACKERS.forEach(tracker => {
    const node = document.getElementById("trackerTemplate").content.cloneNode(true);
    const card = node.querySelector(".tracker-card");
    card.dataset.id = tracker.id;

    node.querySelector(".card-type").textContent = tracker.type;
    node.querySelector(".card-title").textContent = tracker.title;
    node.querySelector(".date-input").value = today();

    container.appendChild(node);
    renderCard(tracker.id);
  });

  renderDashboard();
}

function renderDashboard() {
  const householdTotal = TRACKERS.reduce((sum, tracker) => sum + totalFor(tracker.id), 0);
  const allMilestones = TRACKERS.flatMap(tracker =>
    tracker.milestones.map(milestone => ({
      ...milestone,
      trackerId: tracker.id,
      trackerTitle: tracker.title,
      total: totalFor(tracker.id)
    }))
  );

  const earned = allMilestones.filter(m => m.total >= m.amount).length;
  const next = allMilestones
    .filter(m => m.total < m.amount)
    .map(m => m.amount - m.total)
    .sort((a, b) => a - b)[0];

  document.getElementById("householdTotal").textContent = money.format(householdTotal);
  document.getElementById("certificatesEarned").textContent = `${earned} of ${allMilestones.length}`;
  document.getElementById("nextCertificate").textContent = next === undefined ? "All earned" : money.format(next);
}

function renderCard(id) {
  const tracker = TRACKERS.find(t => t.id === id);
  const card = document.querySelector(`[data-id="${id}"]`);
  const transactions = load(id);
  const total = totalFor(id);
  const remaining = Math.max(0, tracker.goal - total);
  const percent = pct(total, tracker.goal);

  card.querySelector(".spent").textContent = money.format(total);
  card.querySelector(".remaining").textContent = money.format(remaining);
  card.querySelector(".complete").textContent = `${percent.toFixed(1)}%`;
  card.querySelector(".main-progress-fill").style.width = `${percent}%`;

  renderMilestones(card, tracker, total);
  renderTransactions(card, tracker, transactions);
  wireCard(card, tracker);
}

function renderMilestones(card, tracker, total) {
  const wrap = card.querySelector(".milestones");
  wrap.innerHTML = "";

  tracker.milestones.forEach(m => {
    const earned = total >= m.amount;
    const remaining = Math.max(0, m.amount - total);
    const percent = pct(total, m.amount);
    const item = document.createElement("div");
    item.className = `milestone ${earned ? "earned" : ""}`;
    item.innerHTML = `
      <div class="milestone-top">
        <span>${m.label} at ${money.format(m.amount)}</span>
        <strong>${earned ? "Earned" : money.format(remaining) + " left"}</strong>
      </div>
      <div class="milestone-bar">
        <div class="milestone-fill" style="width:${percent}%"></div>
      </div>
    `;
    wrap.appendChild(item);
  });
}

function renderTransactions(card, tracker, transactions) {
  const list = card.querySelector(".transactions");
  list.innerHTML = "";

  if (!transactions.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No transactions yet.";
    list.appendChild(empty);
    return;
  }

  transactions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(tx => {
      const item = document.createElement("li");
      item.className = "transaction";
      item.innerHTML = `
        <div>
          <strong>${money.format(Number(tx.amount))}</strong>
          <div>${tx.merchant || "Transaction"}</div>
          <div class="meta">${tx.date}</div>
        </div>
        <div class="transaction-actions">
          <button class="secondary edit" type="button">Edit</button>
          <button class="danger delete" type="button">Delete</button>
        </div>
      `;
      item.querySelector(".edit").addEventListener("click", () => editTx(tracker.id, tx.id));
      item.querySelector(".delete").addEventListener("click", () => deleteTx(tracker.id, tx.id));
      list.appendChild(item);
    });
}

function wireCard(card, tracker) {
  const form = card.querySelector(".entry-form");

  card.querySelector(".add-toggle").onclick = () => {
    form.classList.toggle("hidden");
  };

  form.onsubmit = event => {
    event.preventDefault();

    const date = card.querySelector(".date-input").value;
    const merchant = card.querySelector(".merchant-input").value.trim();
    const amount = Number(card.querySelector(".amount-input").value);

    if (!date || !amount || amount <= 0) {
      alert("Enter a valid date and amount.");
      return;
    }

    const transactions = load(tracker.id);
    transactions.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      trackerId: tracker.id,
      date,
      merchant,
      amount
    });

    save(tracker.id, transactions);
    render();
  };

  card.querySelector(".clear-card").onclick = () => {
    if (confirm(`Clear all transactions for ${tracker.title}?`)) {
      save(tracker.id, []);
      render();
    }
  };
}

function editTx(trackerId, id) {
  const transactions = load(trackerId);
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  const date = prompt("Date:", tx.date);
  if (date === null) return;

  const merchant = prompt("Merchant or note:", tx.merchant || "");
  if (merchant === null) return;

  const amount = prompt("Amount:", tx.amount);
  if (amount === null) return;

  const parsed = Number(amount);
  if (!parsed || parsed <= 0) {
    alert("Enter a valid amount.");
    return;
  }

  tx.date = date;
  tx.merchant = merchant.trim();
  tx.amount = parsed;

  save(trackerId, transactions);
  render();
}

function deleteTx(trackerId, id) {
  if (!confirm("Delete this transaction?")) return;
  save(trackerId, load(trackerId).filter(tx => tx.id !== id));
  render();
}

function exportCsv() {
  const rows = [["trackerId","cardTitle","date","merchant","amount"]];
  TRACKERS.forEach(tracker => {
    load(tracker.id).forEach(tx => {
      rows.push([
        tracker.id,
        tracker.title,
        tx.date,
        tx.merchant || "",
        tx.amount
      ]);
    });
  });

  const csv = rows.map(row =>
    row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hilton-free-night-tracker-${new Date().getFullYear()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const lines = text.split(/\r?\n/).filter(Boolean).slice(1);

    const grouped = Object.fromEntries(TRACKERS.map(t => [t.id, load(t.id)]));

    lines.forEach(line => {
      const columns = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(value =>
        value.replace(/^"|"$/g, "").replaceAll('""', '"')
      );

      if (!columns || columns.length < 5) return;

      const [trackerId, , date, merchant, amount] = columns;
      if (!grouped[trackerId]) return;

      grouped[trackerId].push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        trackerId,
        date,
        merchant,
        amount: Number(amount)
      });
    });

    Object.entries(grouped).forEach(([trackerId, transactions]) => save(trackerId, transactions));
    render();
    alert("CSV imported.");
  };

  reader.readAsText(file);
}

document.getElementById("exportCsv").addEventListener("click", exportCsv);

document.getElementById("importCsv").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) importCsv(file);
});

document.getElementById("resetAll").addEventListener("click", () => {
  if (confirm("Export a CSV backup first if needed. Reset all trackers for the new year?")) {
    TRACKERS.forEach(tracker => save(tracker.id, []));
    render();
  }
});

render();
