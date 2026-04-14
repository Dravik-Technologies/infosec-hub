/* CIM-ARC Admin Panel
 * Handles login, tab navigation, and data editing for all 5 JSON data files.
 */

(function () {
  'use strict';

  var TOKEN_KEY = 'cimarc_admin_token';
  var token = sessionStorage.getItem(TOKEN_KEY);
  var cache = {};

  // ── Utility ─────────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function el(id) { return document.getElementById(id); }

  function apiGet(file) {
    return fetch('/api/data/' + file, {
      headers: token ? { 'x-session-token': token } : {}
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function apiPost(file, data) {
    return fetch('/api/data/' + file, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function showMsg(msgEl, text, type) {
    msgEl.textContent = text;
    msgEl.className = 'save-msg ' + type;
    setTimeout(function () { msgEl.textContent = ''; msgEl.className = 'save-msg'; }, 3000);
  }

  function saveBar(onSave) {
    var bar = document.createElement('div');
    bar.className = 'save-bar';
    var btn = document.createElement('button');
    btn.className = 'btn-save';
    btn.textContent = 'Save Changes';
    var msg = document.createElement('span');
    msg.className = 'save-msg';
    bar.appendChild(btn);
    bar.appendChild(msg);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Saving...';
      Promise.resolve(onSave()).then(function () {
        showMsg(msg, 'Saved successfully.', 'ok');
      }).catch(function (e) {
        showMsg(msg, 'Save failed: ' + e.message, 'err');
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      });
    });
    return bar;
  }

  function fieldGroup(labelText, inputEl, hint) {
    var wrap = document.createElement('div');
    wrap.className = 'field-group';
    var lbl = document.createElement('label');
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
    wrap.appendChild(inputEl);
    if (hint) {
      var h = document.createElement('p');
      h.className = 'hint';
      h.textContent = hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  function input(val, placeholder) {
    var i = document.createElement('input');
    i.type = 'text';
    i.value = val || '';
    if (placeholder) i.placeholder = placeholder;
    return i;
  }

  function textarea(val, rows, hint) {
    var t = document.createElement('textarea');
    t.value = val || '';
    t.rows = rows || 4;
    if (hint) t.placeholder = hint;
    return t;
  }

  function select(options, current) {
    var s = document.createElement('select');
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === current) o.selected = true;
      s.appendChild(o);
    });
    return s;
  }

  // ── Login ────────────────────────────────────────────────────────────────────

  function init() {
    el('login-btn').addEventListener('click', doLogin);
    el('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    el('logout-btn').addEventListener('click', doLogout);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var pane = el('tab-' + btn.dataset.tab);
        pane.classList.add('active');
        loadTab(btn.dataset.tab);
      });
    });

    if (token) {
      // Validate existing token
      fetch('/api/session', { headers: { 'x-session-token': token } })
        .then(function (r) {
          if (r.ok) showPanel();
          else { token = null; sessionStorage.removeItem(TOKEN_KEY); }
        })
        .catch(function () { token = null; sessionStorage.removeItem(TOKEN_KEY); });
    }
  }

  function doLogin() {
    var un = el('un').value.trim();
    var pw = el('pw').value;
    var btn = el('login-btn');
    var err = el('login-error');
    if (!un || !pw) { err.textContent = 'Username and password required.'; return; }
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: un, password: pw })
    }).then(function (r) {
      if (!r.ok) throw new Error('Invalid credentials');
      return r.json();
    }).then(function (data) {
      token = data.token;
      sessionStorage.setItem(TOKEN_KEY, token);
      err.textContent = '';
      showPanel();
    }).catch(function (e) {
      err.textContent = e.message;
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    });
  }

  function doLogout() {
    fetch('/api/logout', { method: 'POST', headers: { 'x-session-token': token } }).catch(function(){});
    token = null;
    sessionStorage.removeItem(TOKEN_KEY);
    el('admin-panel').style.display = 'none';
    el('login-screen').style.display = 'flex';
    el('un').value = '';
    el('pw').value = '';
  }

  function showPanel() {
    el('login-screen').style.display = 'none';
    el('admin-panel').style.display = 'block';
    loadTab('blog');
  }

  // ── Tab loader ───────────────────────────────────────────────────────────────

  function loadTab(tab) {
    if (cache[tab]) return; // already rendered
    apiGet(tab + '.json').then(function (data) {
      cache[tab] = data;
      var pane = el('tab-' + tab);
      pane.innerHTML = '';
      switch (tab) {
        case 'blog':           renderBlog(pane, data); break;
        case 'glossary':       renderGlossary(pane, data); break;
        case 'schedule':       renderSchedule(pane, data); break;
        case 'monthly-reports': renderMonthlyReports(pane, data); break;
        case 'digital-pmr':    renderDigitalPmr(pane, data); break;
      }
    }).catch(function (e) {
      el('tab-' + tab).innerHTML = '<p style="color:#e05c5c;padding:1rem 0;">Failed to load data: ' + esc(e.message) + '</p>';
    });
  }

  function reload(tab) {
    delete cache[tab];
    el('tab-' + tab).innerHTML = '<p class="loading-msg">Loading...</p>';
    loadTab(tab);
  }

  // ── Collapsible card helper ──────────────────────────────────────────────────

  function makeCard(titleText, metaText, bodyEl, actionsArr) {
    var card = document.createElement('div');
    card.className = 'admin-card';

    var hdr = document.createElement('div');
    hdr.className = 'card-header';

    var info = document.createElement('div');
    var t = document.createElement('div');
    t.className = 'card-title';
    t.textContent = titleText;
    info.appendChild(t);
    if (metaText) {
      var m = document.createElement('div');
      m.className = 'card-meta';
      m.textContent = metaText;
      info.appendChild(m);
    }

    var actions = document.createElement('div');
    actions.className = 'card-actions';
    (actionsArr || []).forEach(function (a) { actions.appendChild(a); });

    hdr.appendChild(info);
    hdr.appendChild(actions);
    card.appendChild(hdr);

    var body = document.createElement('div');
    body.className = 'card-body';
    body.appendChild(bodyEl);
    card.appendChild(body);

    // Toggle on header click (but not on action buttons)
    hdr.addEventListener('click', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      body.classList.toggle('open');
    });

    return card;
  }

  // ── BLOG ────────────────────────────────────────────────────────────────────

  function renderBlog(pane, posts) {
    var head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = '<h2>Blog Posts</h2>';
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-icon gold';
    addBtn.textContent = '+ New Post';
    head.appendChild(addBtn);
    pane.appendChild(head);

    // Add-new form
    var addForm = document.createElement('div');
    addForm.className = 'add-form';
    addForm.innerHTML = '<h3>New Blog Post</h3>';
    var nDate = input('', 'e.g. 25 MAR 2026');
    var nCat = input('', 'e.g. DATA STRATEGY');
    var nTitle = input('', 'Post title');
    var nExcerpt = textarea('', 2, 'Short excerpt / teaser sentence');
    var nBody = textarea('', 6, 'Full body — one paragraph per line. HTML like <strong> is supported.');
    var nRow = document.createElement('div'); nRow.className = 'field-row';
    nRow.appendChild(fieldGroup('Date', nDate));
    nRow.appendChild(fieldGroup('Category', nCat));
    addForm.appendChild(nRow);
    addForm.appendChild(fieldGroup('Title', nTitle));
    addForm.appendChild(fieldGroup('Excerpt', nExcerpt));
    addForm.appendChild(fieldGroup('Body Paragraphs', nBody, 'One paragraph per line. HTML tags allowed.'));
    var nSaveBar = saveBar(function () {
      var p = {
        id: Date.now(),
        date: nDate.value.trim(),
        category: nCat.value.trim(),
        title: nTitle.value.trim(),
        excerpt: nExcerpt.value.trim(),
        body: nBody.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
      };
      posts.unshift(p);
      return apiPost('blog.json', posts).then(function () {
        reload('blog');
      });
    });
    addForm.appendChild(nSaveBar);
    pane.appendChild(addForm);

    addBtn.addEventListener('click', function () { addForm.classList.toggle('open'); });

    posts.forEach(function (post, idx) {
      var body = document.createElement('div');

      var row = document.createElement('div'); row.className = 'field-row';
      var fDate = input(post.date); var fCat = input(post.category);
      row.appendChild(fieldGroup('Date', fDate));
      row.appendChild(fieldGroup('Category', fCat));
      body.appendChild(row);

      var fTitle = input(post.title);
      body.appendChild(fieldGroup('Title', fTitle));

      var fExcerpt = textarea(post.excerpt, 2);
      body.appendChild(fieldGroup('Excerpt', fExcerpt));

      var fBody = textarea((post.body || []).join('\n'), 6);
      body.appendChild(fieldGroup('Body Paragraphs', fBody, 'One paragraph per line. HTML tags like <strong> are allowed.'));

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Delete "' + post.title + '"?')) return;
        posts.splice(idx, 1);
        apiPost('blog.json', posts).then(function () { reload('blog'); });
      });

      var bar = saveBar(function () {
        post.date = fDate.value.trim();
        post.category = fCat.value.trim();
        post.title = fTitle.value.trim();
        post.excerpt = fExcerpt.value.trim();
        post.body = fBody.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        return apiPost('blog.json', posts);
      });
      body.appendChild(bar);

      pane.appendChild(makeCard(post.title, post.date + ' · ' + post.category, body, [delBtn]));
    });
  }

  // ── GLOSSARY ─────────────────────────────────────────────────────────────────

  function renderGlossary(pane, terms) {
    var head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = '<h2>Glossary Terms (' + terms.length + ')</h2>';
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-icon gold';
    addBtn.textContent = '+ New Term';
    head.appendChild(addBtn);
    pane.appendChild(head);

    var addForm = document.createElement('div');
    addForm.className = 'add-form';
    addForm.innerHTML = '<h3>New Glossary Term</h3>';
    var nTerm = input('', 'Acronym or term');
    var nDef = textarea('', 3, 'Full definition');
    addForm.appendChild(fieldGroup('Term', nTerm));
    addForm.appendChild(fieldGroup('Definition', nDef));
    var nBar = saveBar(function () {
      terms.push({ term: nTerm.value.trim(), definition: nDef.value.trim() });
      terms.sort(function (a, b) { return a.term.localeCompare(b.term); });
      return apiPost('glossary.json', terms).then(function () { reload('glossary'); });
    });
    addForm.appendChild(nBar);
    pane.appendChild(addForm);
    addBtn.addEventListener('click', function () { addForm.classList.toggle('open'); });

    terms.forEach(function (term, idx) {
      var body = document.createElement('div');
      var fTerm = input(term.term);
      var fDef = textarea(term.definition, 3);
      body.appendChild(fieldGroup('Term', fTerm));
      body.appendChild(fieldGroup('Definition', fDef));

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Delete term "' + term.term + '"?')) return;
        terms.splice(idx, 1);
        apiPost('glossary.json', terms).then(function () { reload('glossary'); });
      });

      var bar = saveBar(function () {
        term.term = fTerm.value.trim();
        term.definition = fDef.value.trim();
        return apiPost('glossary.json', terms);
      });
      body.appendChild(bar);

      pane.appendChild(makeCard(term.term, null, body, [delBtn]));
    });
  }

  // ── SCHEDULE ─────────────────────────────────────────────────────────────────

  function renderSchedule(pane, data) {
    pane.innerHTML = '<div class="section-head"><h2>Schedule</h2></div>';

    // Timeline labels
    var tlSec = document.createElement('div'); tlSec.className = 'sub-section';
    var tlH = document.createElement('h3'); tlH.textContent = 'Timeline Labels';
    tlSec.appendChild(tlH);
    var fLabels = textarea((data.timeline.labels || []).join('\n'), 3);
    tlSec.appendChild(fieldGroup('Labels (one per line)', fLabels, 'e.g. Jan 2026'));
    var tlBar = saveBar(function () {
      data.timeline.labels = fLabels.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      return apiPost('schedule.json', data);
    });
    tlSec.appendChild(tlBar);
    pane.appendChild(tlSec);

    // Phases
    var phHead = document.createElement('div'); phHead.className = 'section-head';
    phHead.innerHTML = '<h2>Phases</h2>';
    pane.appendChild(phHead);

    data.phases.forEach(function (phase) {
      var body = document.createElement('div');
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fLabel = input(phase.label); var fBadge = input(phase.badgeClass);
      r1.appendChild(fieldGroup('Label', fLabel));
      r1.appendChild(fieldGroup('Badge CSS Class', fBadge, 'e.g. p0-badge, fo-badge'));
      body.appendChild(r1);

      var fTitle = input(phase.title);
      body.appendChild(fieldGroup('Title', fTitle));

      var r2 = document.createElement('div'); r2.className = 'field-row';
      var fDates = input(phase.dates); var fCount = input(String(phase.taskCount));
      r2.appendChild(fieldGroup('Dates', fDates));
      r2.appendChild(fieldGroup('Task Count', fCount));
      body.appendChild(r2);

      var fTasks = textarea((phase.tasks || []).join('\n'), 5);
      body.appendChild(fieldGroup('Tasks (one per line)', fTasks));

      var foRow = document.createElement('div'); foRow.className = 'toggle-row';
      var foCheck = document.createElement('input'); foCheck.type = 'checkbox'; foCheck.checked = !!phase.isFollowOn;
      var foLbl = document.createElement('label'); foLbl.textContent = 'Is Follow-On phase';
      foRow.appendChild(foCheck); foRow.appendChild(foLbl);
      body.appendChild(foRow);

      var bar = saveBar(function () {
        phase.label = fLabel.value.trim();
        phase.badgeClass = fBadge.value.trim();
        phase.title = fTitle.value.trim();
        phase.dates = fDates.value.trim();
        phase.taskCount = parseInt(fCount.value, 10) || 0;
        phase.tasks = fTasks.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        phase.isFollowOn = foCheck.checked;
        return apiPost('schedule.json', data);
      });
      body.appendChild(bar);

      pane.appendChild(makeCard(phase.label + ' — ' + phase.title, phase.dates, body));
    });

    // Milestones
    var mlHead = document.createElement('div'); mlHead.className = 'section-head'; mlHead.style.marginTop = '2rem';
    mlHead.innerHTML = '<h2>Milestones</h2>';
    pane.appendChild(mlHead);

    data.milestones.forEach(function (m) {
      var body = document.createElement('div');
      var r = document.createElement('div'); r.className = 'field-row';
      var fName = input(m.name); var fDate = input(m.date);
      r.appendChild(fieldGroup('Name', fName));
      r.appendChild(fieldGroup('Date', fDate));
      body.appendChild(r);
      var fDetail = textarea(m.detail, 2);
      body.appendChild(fieldGroup('Detail', fDetail));
      var bar = saveBar(function () {
        m.name = fName.value.trim();
        m.date = fDate.value.trim();
        m.detail = fDetail.value.trim();
        return apiPost('schedule.json', data);
      });
      body.appendChild(bar);
      pane.appendChild(makeCard(m.name, m.date, body));
    });
  }

  // ── MONTHLY REPORTS ───────────────────────────────────────────────────────────

  function renderMonthlyReports(pane, reports) {
    var head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = '<h2>Monthly Reports</h2>';
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-icon gold';
    addBtn.textContent = '+ New Report';
    head.appendChild(addBtn);
    pane.appendChild(head);

    var addForm = document.createElement('div');
    addForm.className = 'add-form';
    addForm.innerHTML = '<h3>New Monthly Report</h3>';
    var nLabel = input('', 'e.g. APR 2026');
    var nTitle = input('Data Fabric Monthly Status Report');
    var nPeriod = input('', 'e.g. April 1 – April 30, 2026');
    var nSummary = textarea('', 3);
    var nAccomp = textarea('', 4, 'One item per line');
    var nUpcoming = textarea('', 3, 'One item per line');
    var nRisks = textarea('', 3, 'One item per line (prefix with Risk: or Issue:)');
    addForm.appendChild(fieldGroup('Month Label', nLabel));
    addForm.appendChild(fieldGroup('Title', nTitle));
    addForm.appendChild(fieldGroup('Reporting Period', nPeriod));
    addForm.appendChild(fieldGroup('Executive Summary', nSummary));
    addForm.appendChild(fieldGroup('Accomplishments', nAccomp));
    addForm.appendChild(fieldGroup('Upcoming Activities', nUpcoming));
    addForm.appendChild(fieldGroup('Risks & Issues', nRisks));
    var nBar = saveBar(function () {
      var r = {
        id: nLabel.value.trim().toLowerCase().replace(/\s+/, '-'),
        monthLabel: nLabel.value.trim(),
        title: nTitle.value.trim(),
        period: nPeriod.value.trim(),
        executiveSummary: nSummary.value.trim(),
        accomplishments: nAccomp.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean),
        upcomingActivities: nUpcoming.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean),
        risks: nRisks.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
      };
      reports.unshift(r);
      return apiPost('monthly-reports.json', reports).then(function () { reload('monthly-reports'); });
    });
    addForm.appendChild(nBar);
    pane.appendChild(addForm);
    addBtn.addEventListener('click', function () { addForm.classList.toggle('open'); });

    reports.forEach(function (rep, idx) {
      var body = document.createElement('div');
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fLabel = input(rep.monthLabel); var fPeriod = input(rep.period);
      r1.appendChild(fieldGroup('Month Label', fLabel));
      r1.appendChild(fieldGroup('Reporting Period', fPeriod));
      body.appendChild(r1);
      var fTitle = input(rep.title);
      body.appendChild(fieldGroup('Title', fTitle));
      var fSummary = textarea(rep.executiveSummary, 3);
      body.appendChild(fieldGroup('Executive Summary', fSummary));
      var fAccomp = textarea((rep.accomplishments || []).join('\n'), 4);
      body.appendChild(fieldGroup('Accomplishments', fAccomp, 'One item per line'));
      var fUpcoming = textarea((rep.upcomingActivities || []).join('\n'), 3);
      body.appendChild(fieldGroup('Upcoming Activities', fUpcoming, 'One item per line'));
      var fRisks = textarea((rep.risks || []).join('\n'), 3);
      body.appendChild(fieldGroup('Risks & Issues', fRisks, 'One item per line (prefix with Risk: or Issue:)'));

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Delete report "' + rep.monthLabel + '"?')) return;
        reports.splice(idx, 1);
        apiPost('monthly-reports.json', reports).then(function () { reload('monthly-reports'); });
      });

      var bar = saveBar(function () {
        rep.monthLabel = fLabel.value.trim();
        rep.period = fPeriod.value.trim();
        rep.title = fTitle.value.trim();
        rep.executiveSummary = fSummary.value.trim();
        rep.accomplishments = fAccomp.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        rep.upcomingActivities = fUpcoming.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        rep.risks = fRisks.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        return apiPost('monthly-reports.json', reports);
      });
      body.appendChild(bar);

      pane.appendChild(makeCard(rep.monthLabel + ' — ' + rep.title, rep.period, body, [delBtn]));
    });
  }

  // ── DIGITAL PMR ──────────────────────────────────────────────────────────────

  function renderDigitalPmr(pane, d) {
    pane.innerHTML = '<div class="section-head"><h2>Digital PMR</h2></div>';

    function pmrSaveBar(label) {
      return saveBar(function () { return apiPost('digital-pmr.json', d); });
    }

    // Helper: status card list editor
    function statusCardEditor(cards, container) {
      cards.forEach(function (c) {
        var r = document.createElement('div'); r.className = 'field-row';
        var fLabel = input(c.label); var fClass = input(c.statusClass); var fText = input(c.statusText);
        r.appendChild(fieldGroup('Label', fLabel));
        r.appendChild(fieldGroup('Status Class', fClass, 'on-track / caution / off-track'));
        r.appendChild(fieldGroup('Status Text', fText));
        container.appendChild(r);
        var fDesc = input(c.description);
        container.appendChild(fieldGroup('Description', fDesc));
        // Link inputs to object
        fLabel.addEventListener('input', function () { c.label = fLabel.value; });
        fClass.addEventListener('input', function () { c.statusClass = fClass.value; });
        fText.addEventListener('input', function () { c.statusText = fText.value; });
        fDesc.addEventListener('input', function () { c.description = fDesc.value; });
        var divider = document.createElement('hr');
        divider.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0.75rem 0;';
        container.appendChild(divider);
      });
    }

    // ── 1. KPIs ──
    var kpiSec = document.createElement('div'); kpiSec.className = 'sub-section';
    kpiSec.innerHTML = '<h3>KPI Status Cards</h3>';
    statusCardEditor(d.kpis.statusCards, kpiSec);

    var kpiPerfSec = document.createElement('div'); kpiPerfSec.className = 'sub-section'; kpiPerfSec.style.marginTop = '0.75rem';
    kpiPerfSec.innerHTML = '<h3>Performance Lists</h3>';
    var fBudget = textarea((d.kpis.budgetPerformance || []).join('\n'), 4);
    var fSched = textarea((d.kpis.schedulePerformance || []).join('\n'), 4);
    var fTech = textarea((d.kpis.technicalPerformance || []).join('\n'), 4);
    kpiPerfSec.appendChild(fieldGroup('Budget Performance (one item per line)', fBudget));
    kpiPerfSec.appendChild(fieldGroup('Schedule Performance (one item per line)', fSched));
    kpiPerfSec.appendChild(fieldGroup('Technical Performance (one item per line)', fTech));

    var kpiBody = document.createElement('div');
    kpiBody.appendChild(kpiSec);
    kpiBody.appendChild(kpiPerfSec);
    var kpiBar = saveBar(function () {
      d.kpis.budgetPerformance = fBudget.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      d.kpis.schedulePerformance = fSched.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      d.kpis.technicalPerformance = fTech.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      return apiPost('digital-pmr.json', d);
    });
    kpiBody.appendChild(kpiBar);
    pane.appendChild(makeCard('KPIs & Performance Lists', null, kpiBody));

    // ── 2. Executive Summary ──
    var execBody = document.createElement('div');
    var execSec = document.createElement('div'); execSec.className = 'sub-section';
    execSec.innerHTML = '<h3>Paragraphs (one per line)</h3>';
    var fParas = textarea((d.executiveSummary.paragraphs || []).join('\n\n'), 6);
    execSec.appendChild(fieldGroup('Paragraphs', fParas, 'Separate paragraphs with a blank line'));
    execBody.appendChild(execSec);
    var execCardSec = document.createElement('div'); execCardSec.className = 'sub-section';
    execCardSec.innerHTML = '<h3>Status Cards</h3>';
    statusCardEditor(d.executiveSummary.statusCards, execCardSec);
    execBody.appendChild(execCardSec);
    var execBar = saveBar(function () {
      d.executiveSummary.paragraphs = fParas.value.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
      return apiPost('digital-pmr.json', d);
    });
    execBody.appendChild(execBar);
    pane.appendChild(makeCard('Executive Summary', null, execBody));

    // ── 3. Resource Allocation ──
    var resBody = document.createElement('div');
    var notesSec = document.createElement('div'); notesSec.className = 'sub-section';
    notesSec.innerHTML = '<h3>Resource Notes</h3>';
    var fNotes = textarea(d.resourceAllocation.notes, 3);
    notesSec.appendChild(fieldGroup('Notes', fNotes));
    resBody.appendChild(notesSec);

    d.resourceAllocation.resources.forEach(function (r) {
      var rsec = document.createElement('div'); rsec.className = 'sub-section';
      var statusChip = document.createElement('span');
      statusChip.className = 'chip' + (r.active ? '' : ' inactive');
      statusChip.textContent = r.active ? 'Active' : 'Inactive';
      rsec.appendChild(statusChip);
      rsec.style.marginTop = '0.5rem';

      var r1 = document.createElement('div'); r1.className = 'field-row'; r1.style.marginTop = '0.75rem';
      var fName = input(r.name); var fAlloc = input(String(r.allocationPct));
      r1.appendChild(fieldGroup('Name', fName));
      r1.appendChild(fieldGroup('Allocation %', fAlloc));
      rsec.appendChild(r1);
      var fRole = input(r.role);
      rsec.appendChild(fieldGroup('Role', fRole));
      var fDesc = input(r.description);
      rsec.appendChild(fieldGroup('Description', fDesc));

      var activeRow = document.createElement('div'); activeRow.className = 'toggle-row';
      var aCheck = document.createElement('input'); aCheck.type = 'checkbox'; aCheck.checked = !!r.active;
      var aLbl = document.createElement('label'); aLbl.textContent = 'Show on public PMR page';
      activeRow.appendChild(aCheck); activeRow.appendChild(aLbl);
      rsec.appendChild(activeRow);

      var rBar = saveBar(function () {
        r.name = fName.value.trim();
        r.allocationPct = parseInt(fAlloc.value, 10) || 0;
        r.role = fRole.value.trim();
        r.description = fDesc.value.trim();
        r.active = aCheck.checked;
        return apiPost('digital-pmr.json', d);
      });
      rsec.appendChild(rBar);
      resBody.appendChild(rsec);
    });

    var notesBar = saveBar(function () {
      d.resourceAllocation.notes = fNotes.value.trim();
      return apiPost('digital-pmr.json', d);
    });
    resBody.appendChild(notesBar);
    pane.appendChild(makeCard('Resource Allocation', null, resBody));

    // ── 4. Spend Plan ──
    var spendBody = document.createElement('div');
    d.spendPlan.items.forEach(function (item) {
      var isec = document.createElement('div'); isec.className = 'sub-section';
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fPkg = input(item.workPackage);
      var fPlanned = input(String(item.planned));
      r1.appendChild(fieldGroup('Work Package', fPkg));
      r1.appendChild(fieldGroup('Planned ($K)', fPlanned));
      isec.appendChild(r1);
      var r2 = document.createElement('div'); r2.className = 'field-row';
      var fActual = input(String(item.actual));
      var fVariance = input(String(item.variance));
      var fPct = input(String(item.pctSpent));
      var r2a = document.createElement('div'); r2a.className = 'field-row-3';
      r2a.appendChild(fieldGroup('Actual ($K)', fActual));
      r2a.appendChild(fieldGroup('Variance ($K)', fVariance));
      r2a.appendChild(fieldGroup('% Spent', fPct));
      isec.appendChild(r2a);
      var badgeOpts = [
        {value:'badge-green',label:'Green — On Track'},
        {value:'badge-gold',label:'Gold — Watch'},
        {value:'badge-red',label:'Red — At Risk'},
        {value:'badge-gray',label:'Gray — Planned'}
      ];
      var fBadge = select(badgeOpts, item.trendBadge);
      var fTrendText = input(item.trendText);
      var r3 = document.createElement('div'); r3.className = 'field-row';
      r3.appendChild(fieldGroup('Trend Badge', fBadge));
      r3.appendChild(fieldGroup('Trend Label', fTrendText));
      isec.appendChild(r3);
      var iBar = saveBar(function () {
        item.workPackage = fPkg.value.trim();
        item.planned = parseFloat(fPlanned.value) || 0;
        item.actual = parseFloat(fActual.value) || 0;
        item.variance = parseFloat(fVariance.value) || 0;
        item.pctSpent = parseFloat(fPct.value) || 0;
        item.trendBadge = fBadge.value;
        item.trendText = fTrendText.value.trim();
        return apiPost('digital-pmr.json', d);
      });
      isec.appendChild(iBar);
      spendBody.appendChild(isec);
    });
    // Total row
    var totSec = document.createElement('div'); totSec.className = 'sub-section';
    totSec.innerHTML = '<h3>Total Row</h3>';
    var t = d.spendPlan.total;
    var tr1 = document.createElement('div'); tr1.className = 'field-row-3';
    var tPlanned = input(String(t.planned)); var tActual = input(String(t.actual)); var tVariance = input(String(t.variance));
    tr1.appendChild(fieldGroup('Planned ($K)', tPlanned));
    tr1.appendChild(fieldGroup('Actual ($K)', tActual));
    tr1.appendChild(fieldGroup('Variance ($K)', tVariance));
    totSec.appendChild(tr1);
    var tr2 = document.createElement('div'); tr2.className = 'field-row';
    var tPct = input(String(t.pctSpent)); var tText = input(t.trendText);
    tr2.appendChild(fieldGroup('% Spent', tPct));
    tr2.appendChild(fieldGroup('Trend Label', tText));
    totSec.appendChild(tr2);
    var fNote = textarea(d.spendPlan.note, 2);
    totSec.appendChild(fieldGroup('Footer Note', fNote));
    var totBar = saveBar(function () {
      t.planned = parseFloat(tPlanned.value) || 0;
      t.actual = parseFloat(tActual.value) || 0;
      t.variance = parseFloat(tVariance.value) || 0;
      t.pctSpent = parseFloat(tPct.value) || 0;
      t.trendText = tText.value.trim();
      d.spendPlan.note = fNote.value.trim();
      return apiPost('digital-pmr.json', d);
    });
    totSec.appendChild(totBar);
    spendBody.appendChild(totSec);
    pane.appendChild(makeCard('Spend Plan Tracker', null, spendBody));

    // ── 5. Technical Accomplishments ──
    var accBody = document.createElement('div');
    d.technicalAccomplishments.forEach(function (a) {
      var asec = document.createElement('div'); asec.className = 'sub-section';
      var fTitle = input(a.title);
      var fDesc = textarea(a.description, 2);
      asec.appendChild(fieldGroup('Title', fTitle));
      asec.appendChild(fieldGroup('Description', fDesc));
      var aBar = saveBar(function () {
        a.title = fTitle.value.trim();
        a.description = fDesc.value.trim();
        return apiPost('digital-pmr.json', d);
      });
      asec.appendChild(aBar);
      accBody.appendChild(asec);
    });
    pane.appendChild(makeCard('Technical Accomplishments', null, accBody));

    // ── 6. Dependencies ──
    var depsBody = document.createElement('div');
    d.dependencies.forEach(function (dep) {
      var dsec = document.createElement('div'); dsec.className = 'sub-section';
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fDep = input(dep.dependency); var fType = input(dep.type);
      r1.appendChild(fieldGroup('Dependency', fDep));
      r1.appendChild(fieldGroup('Type', fType));
      dsec.appendChild(r1);
      var r2 = document.createElement('div'); r2.className = 'field-row';
      var fOwner = input(dep.owner); var fReqBy = input(dep.requiredBy);
      r2.appendChild(fieldGroup('Owner / Source', fOwner));
      r2.appendChild(fieldGroup('Required By', fReqBy));
      dsec.appendChild(r2);
      var badgeOpts = [
        {value:'badge-green',label:'Green'},
        {value:'badge-gold',label:'Gold — Watch'},
        {value:'badge-red',label:'Red'},
        {value:'badge-gray',label:'Gray — Planned'}
      ];
      var r3 = document.createElement('div'); r3.className = 'field-row';
      var fBadge = select(badgeOpts, dep.badgeClass); var fStatus = input(dep.statusText);
      r3.appendChild(fieldGroup('Badge Color', fBadge));
      r3.appendChild(fieldGroup('Status Text', fStatus));
      dsec.appendChild(r3);
      var dBar = saveBar(function () {
        dep.dependency = fDep.value.trim(); dep.type = fType.value.trim();
        dep.owner = fOwner.value.trim(); dep.requiredBy = fReqBy.value.trim();
        dep.badgeClass = fBadge.value; dep.statusText = fStatus.value.trim();
        return apiPost('digital-pmr.json', d);
      });
      dsec.appendChild(dBar);
      depsBody.appendChild(dsec);
    });
    pane.appendChild(makeCard('Project Dependencies', null, depsBody));

    // ── 7. Risks & Action Items ──
    var issuesBody = document.createElement('div');
    var riskHead = document.createElement('h3'); riskHead.textContent = 'Active Risks'; riskHead.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.75rem;';
    issuesBody.appendChild(riskHead);
    d.issues.risks.forEach(function (risk) {
      var rsec = document.createElement('div'); rsec.className = 'sub-section';
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fSev = input(risk.severity); var fTitle = input(risk.title);
      r1.appendChild(fieldGroup('Severity', fSev, 'e.g. MED, HIGH, LOW'));
      r1.appendChild(fieldGroup('Title', fTitle));
      rsec.appendChild(r1);
      var r2 = document.createElement('div'); r2.className = 'field-row';
      var fLike = input(risk.likelihood); var fImpact = textarea(risk.impact, 2);
      r2.appendChild(fieldGroup('Likelihood', fLike));
      r2.appendChild(fieldGroup('Impact', fImpact));
      rsec.appendChild(r2);
      var fMit = textarea(risk.mitigation, 2);
      rsec.appendChild(fieldGroup('Mitigation', fMit));
      var statusOpts = [{value:'on-track',label:'Green'},{value:'caution',label:'Caution'},{value:'off-track',label:'Red'}];
      var r3 = document.createElement('div'); r3.className = 'field-row';
      var fClass = select(statusOpts, risk.statusClass); var fText = input(risk.statusText);
      r3.appendChild(fieldGroup('Status Class', fClass));
      r3.appendChild(fieldGroup('Status Text', fText));
      rsec.appendChild(r3);
      var rBar = saveBar(function () {
        risk.severity = fSev.value.trim(); risk.title = fTitle.value.trim();
        risk.likelihood = fLike.value.trim(); risk.impact = fImpact.value.trim();
        risk.mitigation = fMit.value.trim(); risk.statusClass = fClass.value;
        risk.statusText = fText.value.trim();
        return apiPost('digital-pmr.json', d);
      });
      rsec.appendChild(rBar);
      issuesBody.appendChild(rsec);
    });

    var aiHead = document.createElement('h3'); aiHead.textContent = 'Action Items'; aiHead.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin:1.5rem 0 0.75rem 0;';
    issuesBody.appendChild(aiHead);
    d.issues.actionItems.forEach(function (ai) {
      var asec = document.createElement('div'); asec.className = 'sub-section';
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fId = input(ai.id); var fTitle = input(ai.title);
      r1.appendChild(fieldGroup('ID', fId, 'e.g. AI-006'));
      r1.appendChild(fieldGroup('Title', fTitle));
      asec.appendChild(r1);
      var r2 = document.createElement('div'); r2.className = 'field-row';
      var fOwner = input(ai.owner); var fDue = input(ai.due);
      r2.appendChild(fieldGroup('Owner', fOwner));
      r2.appendChild(fieldGroup('Due', fDue));
      asec.appendChild(r2);
      var r3 = document.createElement('div'); r3.className = 'field-row';
      var fStatus = input(ai.statusText);
      var badgeOpts = [{value:'on-track',label:'Green (OPEN/DONE)'},{value:'caution',label:'Caution (PENDING)'}];
      var fBadge = select(badgeOpts, ai.badgeClass); var fBadgeText = input(ai.badgeText);
      r3.appendChild(fieldGroup('Status Text', fStatus));
      r3.appendChild(fieldGroup('Badge Class', fBadge));
      r3.appendChild(fieldGroup('Badge Text', fBadgeText));
      asec.appendChild(r3);
      var aBar = saveBar(function () {
        ai.id = fId.value.trim(); ai.title = fTitle.value.trim();
        ai.owner = fOwner.value.trim(); ai.due = fDue.value.trim();
        ai.statusText = fStatus.value.trim(); ai.badgeClass = fBadge.value;
        ai.badgeText = fBadgeText.value.trim();
        return apiPost('digital-pmr.json', d);
      });
      asec.appendChild(aBar);
      issuesBody.appendChild(asec);
    });
    pane.appendChild(makeCard('Issues & Action Items', null, issuesBody));

    // ── 8. Plan Forward ──
    var planBody = document.createElement('div');
    d.planForward.forEach(function (item) {
      var psec = document.createElement('div'); psec.className = 'sub-section';
      var r1 = document.createElement('div'); r1.className = 'field-row';
      var fDate = input(item.date); var fTitle = input(item.title);
      r1.appendChild(fieldGroup('Date', fDate));
      r1.appendChild(fieldGroup('Title', fTitle));
      psec.appendChild(r1);
      var fDesc = textarea(item.description, 2);
      psec.appendChild(fieldGroup('Description', fDesc));
      var upRow = document.createElement('div'); upRow.className = 'toggle-row';
      var upCheck = document.createElement('input'); upCheck.type = 'checkbox'; upCheck.checked = !!item.upcoming;
      var upLbl = document.createElement('label'); upLbl.textContent = 'Mark as upcoming (lighter dot)';
      upRow.appendChild(upCheck); upRow.appendChild(upLbl);
      psec.appendChild(upRow);
      var pBar = saveBar(function () {
        item.date = fDate.value.trim(); item.title = fTitle.value.trim();
        item.description = fDesc.value.trim(); item.upcoming = upCheck.checked;
        return apiPost('digital-pmr.json', d);
      });
      psec.appendChild(pBar);
      planBody.appendChild(psec);
    });
    pane.appendChild(makeCard('Plan Forward', null, planBody));
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
