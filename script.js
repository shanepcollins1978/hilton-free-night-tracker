const GOAL_SURPASS = 15000;
const GOAL_ASPIRE = 60000;
const defaultTrackers=[
{id:"shane-surpass",name:"Shane’s Hilton Surpass",goal:GOAL_SURPASS,accountIds:["22005","72011"],transactions:[]},
{id:"diana-surpass",name:"Diana’s Hilton Surpass",goal:GOAL_SURPASS,accountIds:["71005","21031"],transactions:[]},
{id:"shane-aspire",name:"Shane’s Hilton Aspire",goal:GOAL_ASPIRE,accountIds:["41008","41016"],transactions:[]}
];
let trackers=JSON.parse(localStorage.getItem("hiltonTrackers"))||defaultTrackers;
function saveTrackers(){localStorage.setItem("hiltonTrackers",JSON.stringify(trackers));}
function formatMoney(amount){return amount.toLocaleString("en-US",{style:"currency",currency:"USD"});}
function renderTrackers(){const c=document.getElementById("trackers");c.innerHTML="";
trackers.forEach(tracker=>{const total=tracker.transactions.reduce((s,t)=>s+t.amount,0);
const percent=Math.min((total/tracker.goal)*100,100);const remaining=Math.max(tracker.goal-total,0);
const card=document.createElement("section");card.className="card";
card.innerHTML=`<h2>${tracker.name}</h2><div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
<div class="stats"><div><strong>Total Spent:</strong> ${formatMoney(total)}</div><div><strong>Remaining:</strong> ${formatMoney(remaining)}</div><div><strong>Completed:</strong> ${percent.toFixed(1)}%</div></div>
<input id="date-${tracker.id}" type="date"/><input id="desc-${tracker.id}" type="text" placeholder="Description"/>
<input id="amount-${tracker.id}" type="number" placeholder="Amount"/><button onclick="addTransaction('${tracker.id}')">Add Transaction</button>
<button class="danger" onclick="clearTransactions('${tracker.id}')">Clear Transactions</button>
<details class="transactions-section"><summary>Transactions (${tracker.transactions.length})</summary><div>${tracker.transactions.map(tx=>`<div class="transaction"><strong>${formatMoney(tx.amount)}</strong> ${tx.description||""}<br><small>${tx.date||""} ${tx.source==="csv"?"CSV Upload":"Manual"}</small></div>`).join("")}</div></details>`;
c.appendChild(card);});}
function addTransaction(id){const t=trackers.find(x=>x.id===id);const amount=Number(document.getElementById(`amount-${id}`).value);
if(!amount||amount<=0){alert("Enter a valid amount.");return;}
t.transactions.push({id:Date.now(),date:document.getElementById(`date-${id}`).value,description:document.getElementById(`desc-${id}`).value,amount,source:"manual"});
saveTrackers();renderTrackers();}
function clearTransactions(id){const t=trackers.find(x=>x.id===id);if(!confirm(`Clear all transactions for ${t.name}?`)) return;t.transactions=[];saveTrackers();renderTrackers();}
function importCSV(){alert("CSV import code included in source example.");}
renderTrackers();