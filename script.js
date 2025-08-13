// ---- State & Helpers ----
const state = {
  name: "",
  date: "",
  items: [] // { section, text, priority, timestamp, done }
};

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowPretty() {
  const d = new Date();
  return d.toLocaleString();
}

function storageKey(dateStr) {
  return `standup:${dateStr}`;
}

function save() {
  localStorage.setItem(
    storageKey(state.date),
    JSON.stringify({ name: state.name, items: state.items })
  );
}

function load(dateStr) {
  const raw = localStorage.getItem(storageKey(dateStr));
  if (!raw) return { name: "", items: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { name: "", items: [] };
  }
}

// ---- Rendering ----
function render() {
  // Inputs
  qs("#name").value = state.name || "";
  qs("#date").value = state.date;

  // Clear lists
  qs("#yesterdayList").innerHTML = "";
  qs("#todayList").innerHTML = "";
  qs("#blockersList").innerHTML = "";

  // Render items per section
  state.items.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "item";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!item.done;
    chk.addEventListener("change", () => {
      item.done = chk.checked;
      save();
      // optional: visual strike
      txt.style.textDecoration = item.done ? "line-through" : "none";
      txt.style.opacity = item.done ? "0.7" : "1";
    });

    const txt = document.createElement("div");
    txt.className = "text";
    txt.textContent = item.text;
    if (item.done) { txt.style.textDecoration = "line-through"; txt.style.opacity = "0.7"; }

    const pri = document.createElement("span");
    pri.className = `tag ${item.priority}`;
    pri.textContent = item.priority;

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = item.timestamp;

    const del = document.createElement("button");
    del.className = "btn-icon";
    del.title = "Delete";
    del.innerHTML = "🗑️";
    del.addEventListener("click", () => {
      state.items.splice(idx, 1);
      save(); render();
    });

    li.appendChild(chk);
    li.appendChild(txt);
    li.appendChild(pri);
    li.appendChild(time);
    li.appendChild(del);

    const listEl =
      item.section === "Yesterday" ? qs("#yesterdayList") :
      item.section === "Today" ? qs("#todayList") :
      qs("#blockersList");

    listEl.appendChild(li);
  });
}

// ---- Adders ----
function addItem(section, inputSel, prioritySel) {
  const text = qs(inputSel).value.trim();
  const priority = qs(prioritySel).value;
  if (!text) return;

  state.items.push({
    section,
    text,
    priority,
    timestamp: nowPretty(),
    done: false
  });

  qs(inputSel).value = "";
  save();
  render();
}

// ---- Copy to Clipboard ----
function buildTextExport() {
  const header = `Standup — ${state.date}\nName: ${state.name || "(unnamed)"}\n`;
  const sections = ["Yesterday", "Today", "Blockers"];
  const lines = sections.map(sec => {
    const items = state.items.filter(i => i.section === sec);
    if (items.length === 0) return `${sec}:\n  - (none)`;
    const bullets = items.map(i => `  - [${i.priority}] ${i.text}${i.done ? " (done)" : ""}`).join("\n");
    return `${sec}:\n${bullets}`;
  }).join("\n\n");

  return `${header}\n${sections.length ? lines : ""}\n`;
}

async function copyToClipboard() {
  const text = buildTextExport();
  try {
    await navigator.clipboard.writeText(text);
    flash("Copied standup to clipboard ✅");
  } catch (e) {
    flash("Copy failed. Select & copy manually.", true);
    console.log(e);
  }
}

function flash(msg, danger = false) {
  let n = document.createElement("div");
  n.textContent = msg;
  n.style.position = "fixed";
  n.style.bottom = "20px";
  n.style.left = "50%";
  n.style.transform = "translateX(-50%)";
  n.style.padding = "10px 14px";
  n.style.borderRadius = "10px";
  n.style.color = "#fff";
  n.style.background = danger ? "#ef4444" : "#10b981";
  n.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1800);
}

// ---- Export to Excel (.xlsx) ----
function exportToExcel() {
  // Build tabular data
  const rows = state.items.map(i => ({
    Date: state.date,
    Name: state.name || "",
    Section: i.section,
    Task: i.text,
    Priority: i.priority,
    Timestamp: i.timestamp,
    Status: i.done ? "Done" : "Pending"
  }));

  if (rows.length === 0) {
    flash("No items to export.", true);
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Standup");

  const filename = `standup_${state.name || "user"}_${state.date}.xlsx`.replace(/\s+/g, "_");
  XLSX.writeFile(wb, filename);
}

// ---- Theme ----
function applyTheme(t) {
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem("standup:theme", t);
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  // Theme
  const savedTheme = localStorage.getItem("standup:theme") || "light";
  applyTheme(savedTheme);

  // Date
  const dateInput = qs("#date");
  dateInput.value = todayISO();

  // Load state for today
  state.date = dateInput.value;
  const loaded = load(state.date);
  state.name = loaded.name || "";
  state.items = loaded.items || [];
  render();

  // Handlers
  qs("#name").addEventListener("input", (e) => {
    state.name = e.target.value;
    save();
  });

  dateInput.addEventListener("change", (e) => {
    state.date = e.target.value || todayISO();
    const d = load(state.date);
    state.name = d.name || "";
    state.items = d.items || [];
    render();
  });

  qs("#addYesterday").addEventListener("click", () => addItem("Yesterday", "#yesterdayInput", "#yesterdayPriority"));
  qs("#addToday").addEventListener("click", () => addItem("Today", "#todayInput", "#todayPriority"));
  qs("#addBlockers").addEventListener("click", () => addItem("Blockers", "#blockersInput", "#blockersPriority"));

  // Enter-to-add shortcuts
  qs("#yesterdayInput").addEventListener("keydown", (e) => { if (e.key === "Enter") qs("#addYesterday").click(); });
  qs("#todayInput").addEventListener("keydown", (e) => { if (e.key === "Enter") qs("#addToday").click(); });
  qs("#blockersInput").addEventListener("keydown", (e) => { if (e.key === "Enter") qs("#addBlockers").click(); });

  // Actions
  qs("#copyBtn").addEventListener("click", copyToClipboard);
  qs("#exportBtn").addEventListener("click", exportToExcel);
  qs("#clearBtn").addEventListener("click", () => {
    if (confirm(`Clear all items for ${state.date}?`)) {
      state.items = [];
      save(); render();
    }
  });

  qs("#toggleTheme").addEventListener("click", () => {
    const cur = localStorage.getItem("standup:theme") || "light";
    applyTheme(cur === "light" ? "dark" : "light");
  });
});
