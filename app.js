const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1rVqAjm-l_Urjd3TNmIc3SmTmz_OlgSoBuhY7RPgiuRg/export?format=csv&gid=725349095";

const months = {
  Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5,
  Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11
};

const state = {
  data: [],
  filtered: [],
  selectedConstraints: new Set(),
  page: 1,
  rowsPerPage: 50
};

function parseDate(str){
  if(!str) return null;

  const parts = str.trim().split("-");
  if(parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = months[parts[1]];
  const year = Number(parts[2]);

  if(isNaN(day) || isNaN(year) || month === undefined)
    return null;

  return new Date(year, month, day);
}

function toSeconds(str){
  if(!str) return 0;
  const p = str.split(":").map(Number);
  if(p.length !== 3) return 0;
  return p[0]*3600 + p[1]*60 + p[2];
}

async function loadData(){

  const res = await fetch(CSV_URL);
  const text = await res.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true
  });

  state.data = parsed.data
    .filter(r => r["Video Type"] === "Sudoku")
    .map(r => ({
      title: r["Video Title"],
      dateStr: r["Date"],
      dateObj: parseDate(r["Date"]),
      lengthStr: r["Length"],
      lengthSec: toSeconds(r["Length"]),
      constraints: (r["Puzzle Sub-Type / Constraints"] || "")
        .split(";")
        .map(s => s.trim())
        .filter(Boolean),
      host: r["Host/Solver"] || "",
      setter: r["Setter"] || "",
      link: r["Link YT"]
    }))
    .filter(d => d.dateObj !== null);

  initDefaults();
  applyFilters();
}

function initDefaults(){

  const lengths = state.data.map(d => d.lengthSec);

  document.getElementById("minLength").value =
    Math.floor(Math.min(...lengths)/60);

  document.getElementById("maxLength").value =
    Math.ceil(Math.max(...lengths)/60);

  const dates = state.data.map(d => d.dateObj.getTime());
  const min = new Date(Math.min(...dates));
  const today = new Date();

  document.getElementById("minDate").value =
    min.toISOString().split("T")[0];

  document.getElementById("maxDate").value =
    today.toISOString().split("T")[0];
}

function applyFilters(){

  const search =
    document.getElementById("search").value.toLowerCase();

  const minLen =
    Number(document.getElementById("minLength").value)*60;

  const maxLen =
    Number(document.getElementById("maxLength").value)*60;

  const minDate =
    new Date(document.getElementById("minDate").value);

  const maxDate =
    new Date(document.getElementById("maxDate").value);

  state.filtered = state.data.filter(d => {

    if(!d.title.toLowerCase().includes(search))
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

function renderConstraints(){

  const counts = {};

  state.filtered.forEach(d => {
    d.constraints.forEach(c => {
      counts[c] = (counts[c] || 0) + 1;
    });
  });

  const container =
    document.getElementById("constraintsList");

  container.innerHTML = "";

  Object.keys(counts)
    .sort((a,b)=>counts[b]-counts[a])
    .forEach(c => {

      const label = document.createElement("label");
      const checked =
        state.selectedConstraints.has(c) ? "checked" : "";

      label.innerHTML =
        `<input type="checkbox" ${checked}>
         ${c} (${counts[c]})`;

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

function renderTable(){

  const tbody =
    document.getElementById("tableBody");

  tbody.innerHTML = "";

  const solvedMap =
    JSON.parse(localStorage.getItem("solvedMap") || "{}");

  state.filtered
    .slice((state.page-1)*state.rowsPerPage,
           state.page*state.rowsPerPage)
    .forEach(d => {

      const tr = document.createElement("tr");

      const isSolved =
        solvedMap[d.title] || false;

      const toggle = document.createElement("div");
      toggle.className =
        "toggle" + (isSolved ? " active" : "");

      toggle.onclick = e => {
        e.stopPropagation();
        solvedMap[d.title] = !isSolved;
        localStorage.setItem(
          "solvedMap",
          JSON.stringify(solvedMap)
        );
        renderTable();
      };

      tr.innerHTML = `
        <td></td>
        <td>${d.dateStr}</td>
        <td>${d.title}</td>
        <td>${d.lengthStr}</td>
        <td>${d.constraints.join(", ")}</td>
        <td>${d.host}</td>
        <td>${d.setter}</td>
      `;

      tr.children[0].appendChild(toggle);

      tr.onclick = () =>
        window.open(d.link, "_blank");

      tbody.appendChild(tr);
    });

  document.getElementById("counter").textContent =
    `Showing ${state.filtered.length} of ${state.data.length} sudoku`;
}

document.addEventListener("input", applyFilters);

document.getElementById("resetBtn").onclick =
  () => location.reload();

loadData();
