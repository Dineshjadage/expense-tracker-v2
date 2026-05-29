// =============================================
//   SPENDSMART - app.js v2.0
//   HTML + CSS + Bootstrap + jQuery + Chart.js
// =============================================

$(document).ready(function () {

  // ======== STATE ========
  let transactions = JSON.parse(localStorage.getItem('ss_transactions')) || [];
  let budgets      = JSON.parse(localStorage.getItem('ss_budgets'))      || {};
  let currentTab   = 'dashboard';
  let modalType    = 'expense';
  let barChart, doughnutChart, lineChart, pieChart;

  const CATEGORIES = [
    'Food 🍔','Transport 🚗','Shopping 🛍️','Entertainment 🎬',
    'Health 💊','Education 📚','Salary 💼','Freelance 💻','Other 📦'
  ];

  const CAT_EMOJI = {
    'Food 🍔':'🍔','Transport 🚗':'🚗','Shopping 🛍️':'🛍️',
    'Entertainment 🎬':'🎬','Health 💊':'💊','Education 📚':'📚',
    'Salary 💼':'💼','Freelance 💻':'💻','Other 📦':'📦'
  };

  const CHART_COLORS = ['#5b6ef5','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6'];

  // ======== INIT ========
  setDateDefault();
  populateMonthFilter();
  renderAll();

  const today = new Date();
  $('#current-date').text(today.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));

  // ======== HELPERS ========
  function save() {
    localStorage.setItem('ss_transactions', JSON.stringify(transactions));
    localStorage.setItem('ss_budgets',      JSON.stringify(budgets));
  }

  function fmt(n) {
    return '₹' + parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function escHtml(s) {
    return $('<div>').text(s).html();
  }

  function toast(msg, type = 'success') {
    const el = $(`<div class="toast-item ${type}">${msg}</div>`);
    $('#toast-wrap').append(el);
    setTimeout(() => el.fadeOut(300, () => el.remove()), 2600);
  }

  function setDateDefault() {
    $('#m-date').val(new Date().toISOString().split('T')[0]);
  }

  function getFilteredTxs() {
    const month = $('#month-filter').val();
    if (month === 'all') return transactions;
    return transactions.filter(t => t.date && t.date.slice(0, 7) === month);
  }

  function getCategoryTotals(txList) {
    const totals = {};
    txList.filter(t => t.type === 'expense').forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return totals;
  }

  // ======== MONTH FILTER ========
  function populateMonthFilter() {
    const months = [...new Set(transactions.map(t => t.date && t.date.slice(0,7)))].filter(Boolean).sort().reverse();
    const sel = $('#month-filter');
    sel.find('option:not([value="all"])').remove();
    months.forEach(m => {
      const d = new Date(m + '-01');
      const label = d.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
      sel.append(`<option value="${m}">${label}</option>`);
    });
  }

  // ======== TAB SWITCHING ========
  window.switchTab = function(tab) {
    currentTab = tab;
    $('.tab-content').addClass('d-none');
    $(`#tab-${tab}`).removeClass('d-none');
    $('.nav-link').removeClass('active');
    $(`.nav-link[data-tab="${tab}"]`).addClass('active');

    const titles = { dashboard:'Dashboard', transactions:'Transactions', analytics:'Analytics', budget:'Budget Planner' };
    $('#page-title').text(titles[tab]);

    if (tab === 'analytics')    renderAnalytics();
    if (tab === 'budget')       renderBudget();
    if (tab === 'transactions') renderTransactions();
  };

  // ======== MODAL TYPE ========
  window.setModalType = function(type) {
    modalType = type;
    $('#modal-exp-btn').toggleClass('active', type === 'expense');
    $('#modal-inc-btn').toggleClass('active', type === 'income');
    $('#submit-btn').text(type === 'income' ? 'Add Income' : 'Add Expense');
  };

  // ======== ADD TRANSACTION ========
  window.addTransaction = function() {
    const desc = $('#m-desc').val().trim();
    const amt  = parseFloat($('#m-amt').val());
    const cat  = $('#m-cat').val();
    const date = $('#m-date').val();
    const note = $('#m-note').val().trim();

    if (!desc) { toast('⚠ Please enter a description', 'error'); return; }
    if (!amt || amt <= 0) { toast('⚠ Enter a valid amount', 'error'); return; }
    if (!cat)  { toast('⚠ Please select a category', 'error'); return; }
    if (!date) { toast('⚠ Please select a date', 'error'); return; }

    transactions.push({ id: Date.now(), desc, amount: amt, category: cat, date, note, type: modalType });
    save();
    populateMonthFilter();
    renderAll();

    // Reset
    $('#m-desc').val(''); $('#m-amt').val(''); $('#m-cat').val(''); $('#m-note').val('');
    setDateDefault();

    bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
    toast(modalType === 'income' ? '✅ Income added!' : '✅ Expense added!', 'success');
  };

  // ======== DELETE ========
  $(document).on('click', '.del-btn', function() {
    const id = parseInt($(this).data('id'));
    transactions = transactions.filter(t => t.id !== id);
    save();
    populateMonthFilter();
    renderAll();
    toast('🗑 Transaction deleted', 'warning');
  });

  // ======== CLEAR ALL ========
  window.clearAll = function() {
    if (!transactions.length) { toast('Nothing to clear', 'warning'); return; }
    if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
    transactions = [];
    save();
    populateMonthFilter();
    renderAll();
    toast('🗑 All transactions cleared', 'warning');
  };

  // ======== EXPORT CSV ========
  window.exportCSV = function() {
    if (!transactions.length) { toast('No data to export', 'warning'); return; }
    const headers = ['Date','Description','Category','Type','Amount','Note'];
    const rows = transactions
      .sort((a,b) => new Date(b.date)-new Date(a.date))
      .map(t => [t.date, `"${t.desc}"`, t.category, t.type, t.amount, `"${t.note||''}"`]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'transactions_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    toast('📁 CSV exported!', 'success');
  };

  // ======== RENDER ALL ========
  function renderAll() {
    if (currentTab === 'dashboard')    renderDashboard();
    if (currentTab === 'transactions') renderTransactions();
    if (currentTab === 'analytics')    renderAnalytics();
    if (currentTab === 'budget')       renderBudget();
  }

  $('#month-filter').on('change', function() { renderAll(); });

  // ======== DASHBOARD ========
  function renderDashboard() {
    const txs = getFilteredTxs();
    let inc = 0, exp = 0;
    txs.forEach(t => { t.type === 'income' ? inc += t.amount : exp += t.amount; });
    const bal = inc - exp;

    $('#total-income').text(fmt(inc));
    $('#total-expense').text(fmt(exp));
    $('#net-balance').text(fmt(bal));
    $('#income-count').text(txs.filter(t=>t.type==='income').length + ' entries');
    $('#expense-count').text(txs.filter(t=>t.type==='expense').length + ' entries');

    const savingsRate = inc > 0 ? Math.round((bal / inc) * 100) : 0;
    $('#savings-rate').text(savingsRate + '% savings rate');

    // Avg per day (current month)
    const now = new Date();
    const dayOfMonth = now.getDate();
    const thisMonthTxs = transactions.filter(t => t.type === 'expense' && t.date && t.date.slice(0,7) === now.toISOString().slice(0,7));
    const thisMonthExp = thisMonthTxs.reduce((s,t) => s + t.amount, 0);
    $('#avg-day').text(fmt(thisMonthExp / Math.max(dayOfMonth, 1)));

    renderBarChart(transactions);
    renderDoughnutChart(txs);
    renderRecentList(txs);
  }

  // ======== RECENT TRANSACTIONS ========
  function renderRecentList(txs) {
    const recent = [...txs].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0, 6);
    const $el = $('#recent-list');
    if (!recent.length) {
      $el.html('<div class="empty-state"><div class="ei">📋</div><p>No transactions yet.</p><small>Click "+ Add Transaction" to get started!</small></div>');
      return;
    }
    $el.html(recent.map(t => txHtml(t)).join(''));
  }

  function txHtml(t) {
    const e = CAT_EMOJI[t.category] || '💳';
    const d = new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const sign = t.type === 'income' ? '+' : '-';
    const noteHtml = t.note ? `<div class="tx-note">${escHtml(t.note)}</div>` : '';
    return `<div class="tx-item ${t.type}">
      <div class="tx-left">
        <div class="tx-ico">${e}</div>
        <div>
          <div class="tx-desc">${escHtml(t.desc)}</div>
          <div class="tx-meta">${t.category} · ${d}</div>
          ${noteHtml}
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amt ${t.type}">${sign}${fmt(t.amount)}</span>
        <button class="del-btn" data-id="${t.id}" title="Delete">✕</button>
      </div>
    </div>`;
  }

  // ======== TRANSACTIONS PAGE ========
  window.renderTransactions = function() {
    const search    = $('#search-input').val().toLowerCase().trim();
    const catFilter = $('#filter-cat').val();
    const typeFilter= $('#filter-type').val();
    const sortBy    = $('#sort-by').val();

    let list = getFilteredTxs().filter(t => {
      const mSearch = !search || t.desc.toLowerCase().includes(search) || t.category.toLowerCase().includes(search);
      const mCat    = catFilter  === 'all' || t.category === catFilter;
      const mType   = typeFilter === 'all' || t.type === typeFilter;
      return mSearch && mCat && mType;
    });

    if (sortBy === 'newest')  list.sort((a,b) => new Date(b.date)-new Date(a.date));
    if (sortBy === 'oldest')  list.sort((a,b) => new Date(a.date)-new Date(b.date));
    if (sortBy === 'highest') list.sort((a,b) => b.amount-a.amount);
    if (sortBy === 'lowest')  list.sort((a,b) => a.amount-b.amount);

    $('#tx-count-badge').text(list.length);

    const $el = $('#tx-full-list');
    if (!list.length) {
      $el.html('<div class="empty-state"><div class="ei">🔍</div><p>No transactions match your filters.</p></div>');
      return;
    }
    $el.html(list.map(t => txHtml(t)).join(''));
  };

  $('#search-input').on('input', function() { renderTransactions(); });

  // ======== BAR CHART ========
  function renderBarChart(allTxs) {
    const months = [...new Set(allTxs.map(t => t.date && t.date.slice(0,7)))].filter(Boolean).sort().slice(-6);
    const incData = months.map(m => allTxs.filter(t => t.type==='income'  && t.date.slice(0,7)===m).reduce((s,t)=>s+t.amount,0));
    const expData = months.map(m => allTxs.filter(t => t.type==='expense' && t.date.slice(0,7)===m).reduce((s,t)=>s+t.amount,0));
    const labels  = months.map(m => { const d = new Date(m+'-01'); return d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}); });

    const ctx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Income',  data: incData, backgroundColor:'rgba(16,185,129,0.8)', borderRadius: 6 },
          { label:'Expense', data: expData, backgroundColor:'rgba(239,68,68,0.8)',  borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { font: { family:'Plus Jakarta Sans', size:11 }, usePointStyle:true } } },
        scales: {
          y: { beginAtZero:true, ticks: { callback: v => '₹'+v.toLocaleString('en-IN'), font:{ family:'Plus Jakarta Sans',size:10 } } },
          x: { ticks: { font:{ family:'Plus Jakarta Sans',size:10 } } }
        }
      }
    });
  }

  // ======== DOUGHNUT CHART ========
  function renderDoughnutChart(txs) {
    const totals = getCategoryTotals(txs);
    const labels = Object.keys(totals);
    const data   = Object.values(totals);
    const ctx = document.getElementById('doughnutChart').getContext('2d');
    if (doughnutChart) doughnutChart.destroy();
    if (!labels.length) { ctx.clearRect(0,0,300,300); return; }
    doughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 2, borderColor:'#fff', hoverOffset: 6 }] },
      options: {
        responsive: true,
        cutout: '62%',
        plugins: {
          legend: { position:'right', labels:{ font:{family:'Plus Jakarta Sans',size:11}, usePointStyle:true, padding:12 } },
          tooltip: { callbacks:{ label: ctx => ` ${fmt(ctx.parsed)}` } }
        }
      }
    });
  }

  // ======== ANALYTICS ========
  function renderAnalytics() {
    const txs = getFilteredTxs();

    // Line chart - monthly expense trend
    const allMonths = [...new Set(transactions.map(t => t.date && t.date.slice(0,7)))].filter(Boolean).sort().slice(-8);
    const lineData  = allMonths.map(m => transactions.filter(t => t.type==='expense' && t.date.slice(0,7)===m).reduce((s,t)=>s+t.amount,0));
    const lineLabels= allMonths.map(m => { const d=new Date(m+'-01'); return d.toLocaleDateString('en-IN',{month:'short'}); });

    const ctx1 = document.getElementById('lineChart').getContext('2d');
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: lineLabels,
        datasets: [{
          label:'Monthly Expense',
          data: lineData,
          borderColor: '#5b6ef5',
          backgroundColor: 'rgba(91,110,245,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#5b6ef5',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        plugins: { legend:{ display:false } },
        scales: {
          y: { beginAtZero:true, ticks:{ callback:v=>'₹'+v.toLocaleString('en-IN'), font:{family:'Plus Jakarta Sans',size:10} } },
          x: { ticks:{ font:{family:'Plus Jakarta Sans',size:10} } }
        }
      }
    });

    // Pie chart - income vs expense
    const inc = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const ctx2 = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx2, {
      type: 'pie',
      data: {
        labels: ['Income','Expense'],
        datasets: [{ data:[inc,exp], backgroundColor:['rgba(16,185,129,0.85)','rgba(239,68,68,0.85)'], borderWidth:2, borderColor:'#fff' }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels:{ font:{family:'Plus Jakarta Sans',size:11}, usePointStyle:true } },
          tooltip: { callbacks:{ label:ctx => ` ${fmt(ctx.parsed)}` } }
        }
      }
    });

    // Category breakdown
    const totals = getCategoryTotals(txs);
    const totalExp = Object.values(totals).reduce((s,v)=>s+v,0);
    const sorted   = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
    const $bd = $('#cat-breakdown');
    if (!sorted.length) { $bd.html('<div class="empty-state" style="padding:20px"><p>No expense data.</p></div>'); }
    else {
      $bd.html(sorted.map(([cat,amt]) => {
        const pct = totalExp > 0 ? Math.round((amt/totalExp)*100) : 0;
        return `<div class="cat-row">
          <span class="cat-emoji">${CAT_EMOJI[cat]||'💳'}</span>
          <span class="cat-name">${cat}</span>
          <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%"></div></div>
          <span class="cat-amt">${fmt(amt)}</span>
          <span class="cat-pct">${pct}%</span>
        </div>`;
      }).join(''));
    }

    // Top 5 expenses
    const top5 = [...txs].filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount).slice(0,5);
    const $te = $('#top-expenses');
    if (!top5.length) { $te.html('<div class="empty-state" style="padding:20px"><p>No expenses yet.</p></div>'); }
    else { $te.html(top5.map(t => txHtml(t)).join('')); }
  }

  // ======== BUDGET ========
  function renderBudget() {
    const txs = getFilteredTxs();
    const expCats = CATEGORIES.filter(c => !['Salary 💼','Freelance 💻'].includes(c));
    const catTotals = getCategoryTotals(txs);

    const $el = $('#budget-cards');
    $el.html('<div class="budget-grid">' + expCats.map(cat => {
      const spent = catTotals[cat] || 0;
      const limit = budgets[cat] || 0;
      const pct   = limit > 0 ? Math.min(Math.round((spent/limit)*100), 100) : 0;
      const over  = limit > 0 && spent > limit;
      const color = over ? '#ef4444' : pct > 75 ? '#f59e0b' : '#10b981';
      const pctLabel = limit > 0 ? `${pct}% used${over ? ' — OVER BUDGET!' : ''}` : 'No limit set';
      return `<div class="budget-card">
        <div class="budget-emoji">${CAT_EMOJI[cat]||'💳'}</div>
        <div class="budget-cat">${cat}</div>
        <div class="budget-spent">${fmt(spent)} <span style="font-size:0.72rem;color:#94a3b8;font-weight:500">spent</span></div>
        <div class="budget-limit-row">
          <span class="budget-label-sm">Limit ₹</span>
          <input type="number" class="budget-limit-input" data-cat="${cat}" value="${limit||''}" placeholder="Set limit" min="0"/>
        </div>
        <div class="budget-progress-wrap">
          <div class="budget-progress-bar" style="width:${limit>0?pct:0}%;background:${color}"></div>
        </div>
        <div class="pct-label" style="color:${color}">${pctLabel}</div>
      </div>`;
    }).join('') + '</div>');

    // Save budget on change
    $(document).off('change', '.budget-limit-input').on('change', '.budget-limit-input', function() {
      const cat = $(this).data('cat');
      const val = parseFloat($(this).val()) || 0;
      budgets[cat] = val;
      save();
      renderBudget();
      toast('✅ Budget updated!', 'success');
    });
  }

  // ======== SEED DATA (first load) ========
  if (transactions.length === 0) {
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0');
    const pm = String(now.getMonth()).padStart(2,'0') || '01';
    const seeds = [
      { id:1,  desc:'Monthly Salary',    amount:55000, category:'Salary 💼',        date:`${y}-${m}-01`, note:'May salary', type:'income' },
      { id:2,  desc:'Freelance Project', amount:12000, category:'Freelance 💻',      date:`${y}-${m}-05`, note:'React website', type:'income' },
      { id:3,  desc:'Zomato Orders',     amount:3200,  category:'Food 🍔',           date:`${y}-${m}-07`, note:'', type:'expense' },
      { id:4,  desc:'Ola/Uber Rides',    amount:1200,  category:'Transport 🚗',      date:`${y}-${m}-09`, note:'', type:'expense' },
      { id:5,  desc:'Amazon Shopping',   amount:4500,  category:'Shopping 🛍️',      date:`${y}-${m}-11`, note:'Electronics', type:'expense' },
      { id:6,  desc:'Netflix + Hotstar', amount:1098,  category:'Entertainment 🎬', date:`${y}-${m}-13`, note:'', type:'expense' },
      { id:7,  desc:'Pharmacy',          amount:850,   category:'Health 💊',         date:`${y}-${m}-14`, note:'Vitamins', type:'expense' },
      { id:8,  desc:'Online Course',     amount:2999,  category:'Education 📚',      date:`${y}-${m}-16`, note:'Udemy React', type:'expense' },
      { id:9,  desc:'Grocery Bigbasket', amount:2800,  category:'Food 🍔',           date:`${y}-${m}-18`, note:'Weekly', type:'expense' },
      { id:10, desc:'Previous Salary',   amount:55000, category:'Salary 💼',         date:`${y}-${pm}-01`, note:'April salary', type:'income' },
      { id:11, desc:'Restaurant Dinner', amount:1800,  category:'Food 🍔',           date:`${y}-${pm}-20`, note:'Birthday dinner', type:'expense' },
      { id:12, desc:'Metro Card',        amount:500,   category:'Transport 🚗',      date:`${y}-${pm}-10`, note:'', type:'expense' },
    ];
    transactions = seeds;
    save();
    populateMonthFilter();
    renderAll();
  }

});
