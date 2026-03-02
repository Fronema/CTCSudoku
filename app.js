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
selectedHosts: new Set(),
selectedSetters: new Set(),
page: 1,
rowsPerPage: 50,
sortKey: "date",
sortDir: "desc"
};

/* ================= Utilities ================= */

function parseDate(str){
if(!str) return null;
const parts=str.trim().split("-");
if(parts.length!==3) return null;
const day=Number(parts[0]);
const month=months[parts[1]];
const year=Number(parts[2]);
if(isNaN(day)||isNaN(year)||month===undefined) return null;
return new Date(year,month,day);
}

function toSeconds(str){
if(!str) return 0;
const p=str.split(":").map(Number);
if(p.length!==3) return 0;
return p[0]*3600+p[1]*60+p[2];
}

/* ================= Load Data ================= */

async function loadData(){

const res=await fetch(CSV_URL);
const text=await res.text();
const cleaned=text.replace(/^\s*,+\s*\n/, "");

const parsed=Papa.parse(cleaned,{
header:true,
skipEmptyLines:true
});

state.data=parsed.data
.filter(r=>r["Video Type"]==="Sudoku")
.map(r=>({
title:r["Video Title"],
dateStr:r["Date"],
dateObj:parseDate(r["Date"]),
lengthStr:r["Length"],
lengthSec:toSeconds(r["Length"]),
constraints:(r["Puzzle Sub-Type / Constraints"]||"")
.split(";").map(s=>s.trim()).filter(Boolean),
host:r["Host/Solver"]||"",
setter:r["Setter"]||"",
link:r["Link YT"]
}))
.filter(d=>d.dateObj!==null);

initDefaults();
applyFilters();
}

/* ================= Defaults ================= */

function initDefaults(){

const lengths=state.data.map(d=>d.lengthSec);
document.getElementById("minLength").value=
Math.floor(Math.min(...lengths)/60);
document.getElementById("maxLength").value=
Math.ceil(Math.max(...lengths)/60);

const dates=state.data.map(d=>d.dateObj.getTime());
const min=new Date(Math.min(...dates));
const today=new Date();

document.getElementById("minDate").value=
min.toISOString().split("T")[0];
document.getElementById("maxDate").value=
today.toISOString().split("T")[0];
}

/* ================= Filtering ================= */

function applyFilters(){

const search=document.getElementById("search").value.toLowerCase();
const minLen=Number(document.getElementById("minLength").value)*60;
const maxLen=Number(document.getElementById("maxLength").value)*60;
const minDate=new Date(document.getElementById("minDate").value);
const maxDate=new Date(document.getElementById("maxDate").value);
const mode=document.getElementById("constraintMode").value;

state.filtered=state.data.filter(d=>{

if(!d.title.toLowerCase().includes(search)) return false;
if(d.lengthSec<minLen||d.lengthSec>maxLen) return false;
if(d.dateObj<minDate||d.dateObj>maxDate) return false;

if(state.selectedConstraints.size){
if(mode==="AND"){
if(![...state.selectedConstraints].every(c=>d.constraints.includes(c)))
return false;
}else{
if(![...state.selectedConstraints].some(c=>d.constraints.includes(c)))
return false;
}
}

if(state.selectedHosts.size){
if(![...state.selectedHosts].some(h=>d.host.includes(h)))
return false;
}

if(state.selectedSetters.size){
if(![...state.selectedSetters].some(s=>d.setter.includes(s)))
return false;
}

return true;
});

sortData();
renderConstraints();
renderPeople("host","hostsList",state.selectedHosts);
renderPeople("setter","settersList",state.selectedSetters);
renderTable();
}

/* ================= Sorting ================= */

function sortData(){

const dir=state.sortDir==="asc"?1:-1;

state.filtered.sort((a,b)=>{

let valA,valB;

switch(state.sortKey){
case "date":
valA=a.dateObj; valB=b.dateObj; break;
case "title":
valA=a.title.toLowerCase(); valB=b.title.toLowerCase(); break;
case "length":
valA=a.lengthSec; valB=b.lengthSec; break;
case "host":
valA=a.host.toLowerCase(); valB=b.host.toLowerCase(); break;
case "setter":
valA=a.setter.toLowerCase(); valB=b.setter.toLowerCase(); break;
case "solved":
const solvedMap=JSON.parse(localStorage.getItem("solvedMap")||"{}");
valA=solvedMap[a.title]?1:0;
valB=solvedMap[b.title]?1:0;
break;
default:
return 0;
}

if(valA<valB) return -1*dir;
if(valA>valB) return 1*dir;
return 0;
});
}

/* ================= Constraints ================= */

function renderConstraints(){

const counts={};
state.filtered.forEach(d=>{
d.constraints.forEach(c=>{
counts[c]=(counts[c]||0)+1;
});
});

const container=document.getElementById("constraintsList");
container.innerHTML="";

const all=Object.keys(counts)
.sort((a,b)=>counts[b]-counts[a]);

const top=all.filter(c=>counts[c]>=100);
const rest=all.filter(c=>counts[c]<100);

top.forEach(c=>addConstraint(container,c,counts[c]));

if(rest.length){
const more=document.createElement("details");
more.innerHTML="<summary>More</summary>";
rest.forEach(c=>addConstraint(more,c,counts[c]));
container.appendChild(more);
}

document.querySelector("#constraintsContainer summary")
.textContent=`Constraints (${state.selectedConstraints.size})`;
}

function addConstraint(parent,c,count){

const checked=state.selectedConstraints.has(c)?"checked":"";
const label=document.createElement("label");
label.innerHTML=`<input type="checkbox" ${checked}> ${c} (${count})`;

label.querySelector("input").onchange=e=>{
if(e.target.checked) state.selectedConstraints.add(c);
else state.selectedConstraints.delete(c);
applyFilters();
};

parent.appendChild(label);
}

/* ================= People ================= */

function renderPeople(key,listId,set){

const counts={};
state.filtered.forEach(d=>{
(d[key]||"").split(";").map(v=>v.trim()).filter(Boolean)
.forEach(v=>counts[v]=(counts[v]||0)+1);
});

const container=document.getElementById(listId);
container.innerHTML="";

Object.keys(counts).sort((a,b)=>a.localeCompare(b))
.forEach(name=>{

const checked=set.has(name)?"checked":"";
const label=document.createElement("label");
label.innerHTML=`<input type="checkbox" ${checked}> ${name} (${counts[name]})`;

label.querySelector("input").onchange=e=>{
if(e.target.checked) set.add(name);
else set.delete(name);
applyFilters();
};

container.appendChild(label);
});
}

/* ================= Table ================= */

function renderTable(){

const tbody=document.getElementById("tableBody");
tbody.innerHTML="";
const solvedMap=JSON.parse(localStorage.getItem("solvedMap")||"{}");

state.filtered
.slice((state.page-1)*state.rowsPerPage,state.page*state.rowsPerPage)
.forEach(d=>{

const tr=document.createElement("tr");

const isSolved=solvedMap[d.title]||false;
const toggle=document.createElement("div");
toggle.className="toggle"+(isSolved?" active":"");
toggle.onclick=e=>{
e.stopPropagation();
solvedMap[d.title]=!isSolved;
localStorage.setItem("solvedMap",JSON.stringify(solvedMap));
renderTable();
};

tr.innerHTML=`
<td></td>
<td>${d.dateStr}</td>
<td>${d.title}</td>
<td>${d.lengthStr}</td>
<td>${d.constraints.join(", ")}</td>
<td>${d.host}</td>
<td>${d.setter}</td>
`;

tr.children[0].appendChild(toggle);
tr.onclick=()=>window.open(d.link,"_blank");

tbody.appendChild(tr);
});

document.getElementById("counter").textContent=
`Showing ${state.filtered.length} of ${state.data.length} sudoku`;
}

/* ================= Events ================= */

document.addEventListener("input",applyFilters);

document.querySelectorAll("th[data-sort]").forEach(th=>{
th.addEventListener("click",()=>{
const key=th.dataset.sort;

if(state.sortKey===key){
state.sortDir=state.sortDir==="asc"?"desc":"asc";
}else{
state.sortKey=key;
state.sortDir="asc";
}

applyFilters();
});
});

document.getElementById("resetBtn").onclick=()=>location.reload();

loadData();
