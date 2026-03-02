// CTC Finder - stable build

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1rVqAjm-l_Urjd3TNmIc3SmTmz_OlgSoBuhY7RPgiuRg/export?format=csv&gid=725349095";

const state = {
  data: [],
  filtered: [],
  selectedConstraints: new Set(),
  page: 1,
  rowsPerPage: 50
};

/* ---------------- Utilities ---------------- */

function parseDate(str){
  if(!str) return null;

  const cleaned = str.trim();
  const normalized = cleaned.replace(/-/g, " ");
  const date = new Date(normalized);

  if (isNaN(date.getTime())) return null;
  return date;
}

function toSeconds(str){
  if(!str) return 0;
  const parts = str.split(":").map(Number);
  if(parts.length !== 3) return 0;
  return parts[0]*3600 + parts[1]*60 + parts[2];
}

/* ---------------- Data Loading ---------------- */

async function loadData(){
  const res = await fetch(CSV_URL);
  const text = await res.text();
  const parsed = Papa.parse(text, { header:true, skipEmptyLines:true });

  console.log("Rows loaded:", parsed.data.length);
  console.log("First row sample:", parsed.data[0]);

  // Robust Sudoku detection (no fragile column name dependency)
  const sudokuRows = parsed.data.filter(row =>
    Object.values(row).join(" ").includes("Sudoku")
  );

  console.log("Sudoku rows detected:", sudokuRows.length);

  state.data = sudokuRows.map(row => {
    const parsedDate = parseDate(row.Date);

    return {
      title: row["Video Title"],
      dateStr: row.Date,
      dateObj: parsedDate,
      lengthStr: row.Length,
      lengthSec: toSeconds(row.Length),
      constraints: (row["Puzzle Sub-Type / Constraints"] || "")
        .split(";")
        .map(s => s.trim())
        .filter(Boolean),
      host: row["Host/Solver"] || "",
      setter: row.Setter || "",
      link: row["Link YT"]
    };
  }).filter(d => d.dateObj !== null);

  console.log("Valid parsed entries:", state.data.length);

  if(state.data.length === 0){
    console.warn("No valid Sudoku data parsed.");
    return;
  }

  initDefaults();
  applyFilters();
}

/* ---------------- Defaults ---------------- */

function initDefaults(){

  const validDates = state.data
    .map(d => d.dateObj)
    .filter(d => d && !isNaN(d.getTime()));

  if(validDates.length){
    const min = new Date(Math.min(...validDates.map(d => d.getTime())));
    const today = new Date();

    document.getElementById("minDate").value =
      min.toISOString().slice(0,10);

    document.getElementById("maxDate").value =
      today.toISOString().slice(0,10);
  }

  const validLengths = state.data
    .map(d => d.lengthSec)
    .filter(n => n && !isNaN(n));

  if(validLengths.length){
    document.getElementById("minLength").value =
      Math.floor(Math.min(...validLengths) / 60);

    document.getElementById("maxLength").value =
      Math.ceil(Math.max(...validLengths) / 60);
  }
}

/* ---------------- Filtering ---------------- */

function applyFilters(){

  const search = document.getElementById("search").value.toLowerCase();
  const minLen = Number(document.getElementById("minLength").value) * 60;
  const maxLen = Number(document.getElementById("maxLength").value) * 60;
  const minDate = new Date(document.getElementById("minDate").value);
  const maxDate = new Date(document.getElementById("maxDate").value);

  state.filtered = state.data.filter(d => {

    if(!d.title || !d.title.toLowerCase().includes(search))
      return false;

    if(d.lengthSec < minLen || d.lengthSec > maxLen)
      return false;

    if(d.dateObj < minDate || d.dateObj > maxDate)
      return false;

    return true;
  });

  renderConstraints();
  renderTable();
}

/* ---------------- Constraints ---------------- */

function renderConstraints(){

  const counts = {};

  state.filtered.forEach(d => {
    d.constraints.forEach(c => {
      counts[c] = (counts[c] || 0) + 1;
    });
  });

  const container = document.getElementById("constraintsList");
  container.innerHTML = "";

  Object.keys(counts)
    .sort((a,b)=>counts[b]-counts[a])
    .forEach(c => {

      const label = document.createElement("label");
      const checked = state.selectedConstraints.has(c) ? "checked" : "";

      label.innerHTML =
        `<input type="checkbox" ${checked}>
         <span>${c} (${counts[c]})</span>`;

      label.querySelector("input").onchange = e => {
        if(e.target.checked)
          state.selectedConstraints.add(c);
        else
          state.selectedConstraints.delete(c);

        applyFilters();
      };

      container.appendChild(label);
    });

  document.querySelector("#constraintsContainer summary")
    .textContent =
    `Constraints (${state.selectedConstraints.size})`;
}

/* ---------------- Table ---------------- */

function renderTable(){

  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  const solvedMap =
    JSON.parse(localStorage.getItem("solvedMap") || "{}");

  state.filtered
    .slice((state.page-1)*state.rowsPerPage,
           state.page*state.rowsPerPage)
    .forEach(d => {

      const tr = document.createElement("tr");

      const isSolved = solvedMap[d.title] || false;

      const toggle = document.createElement("div");
      toggle.className = "toggle" + (isSolved ? " active" : "");
      toggle.onclick = e => {
        e.stopPropagation();
        solvedMap[d.title] = !isSolved;
        localStorage.setItem("solvedMap",
          JSON.stringify(solvedMap));
        renderTable();
      };

      tr.innerHTML = `
        <td></td>
        <td>${d.dateStr}</td>
        <td>${d.title}</td>
        <td>${d.lengthStr}</td>
        <td>${d.constraints.map(c =>
          `<span class="badge">${c}</span>`).join("")}</td>
        <td>${d.host}</td>
        <td>${d.setter}</td>
      `;

      tr.children[0].appendChild(toggle);
      tr.onclick = () => window.open(d.link,"_blank");

      tbody.appendChild(tr);
    });

  document.getElementById("counter").textContent =
    `Showing ${state.filtered.length} of ${state.data.length} sudoku`;
}

/* ---------------- Events ---------------- */

document.addEventListener("input", applyFilters);

document.getElementById("resetBtn").onclick = () => {
  location.reload();
};

/* ---------------- Init ---------------- */

loadData();
