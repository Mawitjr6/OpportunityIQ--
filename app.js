const STAGES = ['Lead', 'Qualified', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const CATS = ['Problem', 'Objective', 'Users', 'Requirement', 'Constraint', 'Budget', 'Timeline', 'Open Question'];
const TABS = [['overview', 'Overview'], ['docs', 'Documents'], ['reqs', 'Requirements'], ['assess', 'Assessment'], ['brief', 'Proposal'], ['fu', 'Follow-ups']];

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const setTitle = t => { $('#title').textContent = t; };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };

function seed() {
  const L = (id, company, contact, source, owner, stage, created, extra = {}) => ({
    id, company, contact, email: contact.split(' ')[0].toLowerCase() + '@' + company.split(' ')[0].toLowerCase() + '.com',
    phone: '', source, owner, stage, created, docs: [], reqs: [], followups: [], ...extra
  });
  const note = 'We struggle with manual lead tracking and it is slow. Our goal is to automate proposal preparation. The sales team and managers will use the system. We need CRM integration and report generation. Our budget is around $10,000-$15,000. We want to go live within 3 months. Is licensing for the CRM already in place? Legacy spreadsheets cannot be replaced before launch.';
  return { leads: [
    L(1, 'Acme Logistics', 'Louis Clerk', 'Referral', 'Brian', 'Discovery', '2026-11-02', {
      docs: [{ name: 'Discovery call notes', text: note, date: '2026-11-05' }],
      followups: [{ id: uid(), action: 'Send discovery questionnaire', owner: 'Brian', due: '2026-11-16', done: false }] }),
    L(2, 'Nova Bank', 'Peter Griffin', 'Event', 'Aisha', 'Proposal', '2026-10-21'),
    L(3, 'GreenFarm Ltd', 'Glen Quagmire', 'Email', 'Brian', 'Won', '2026-09-14'),
    L(4, 'Dominos', 'Cleaveland Brown', 'Website', 'Aisha', 'Lost', '2026-09-30'),
    L(5, 'The clam Retail', 'Stewie Harper', 'Referral', 'Aisha', 'Lead', '2026-11-10', {
      followups: [{ id: uid(), action: 'Intro call', owner: 'Aisha', due: '2026-11-12', done: false }] })
  ] };
}
const Store = {
  load() { try { const d = JSON.parse(localStorage.getItem('oiq')); if (d) return d; } catch (e) {} return seed(); },
  save() { try { localStorage.setItem('oiq', JSON.stringify(db)); } catch (e) {} }
};


const RULES = [
  ['Open Question', /\?|unclear|tbd|not sure/i],
  ['Budget', /\$\s?\d|budget/i],
  ['Timeline', /\d+\s*(day|week|month)s?|deadline|by (q[1-4]|end of)/i],
  ['Constraint', /constraint|compliance|legacy|must not|cannot|regulat/i],
  ['Problem', /problem|manual|struggl|slow|pain|difficult|challenge/i],
  ['Objective', /goal|objective|aim|want to|automate|improve/i],
  ['Requirement', /need|must|require|integrat|report|should/i],
  ['Users', /users?\b|team|staff|managers?/i]
];
function extract(l) {
  const seen = new Set(l.reqs.map(r => r.ev)); let n = 0;
  l.docs.forEach(d => d.text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 15).forEach(s => {
    const hit = RULES.filter(r => r[1].test(s));
    if (!hit.length || seen.has(s)) return;
    seen.add(s); n++;
    l.reqs.push({ id: uid(), category: hit[0][0], text: s, ev: s, src: d.name, conf: Math.min(0.95, 0.5 + hit.length * 0.15), state: 'pending' });
  }));
  return n;
}
function assess(l) {
  const ok = l.reqs.filter(r => r.state !== 'rejected'), has = c => ok.some(r => r.category === c);
  const all = ok.map(r => r.text).join(' '), nReq = ok.filter(r => r.category === 'Requirement').length, risks = [];
  if (!has('Budget')) risks.push(['Pricing Risk', 'High', 'No budget indicator captured.']);
  if (!has('Timeline')) risks.push(['Delivery Risk', 'High', 'No timeline indicator captured.']);
  if (/integrat|legacy|api/i.test(all)) risks.push(['Technical Risk', 'Medium', 'Integrations or legacy systems mentioned.']);
  if (nReq > 6 || ok.filter(r => r.category === 'Open Question').length > 2) risks.push(['Scope Risk', 'Medium', 'Large or unclear scope.']);
  if (/licen|compliance|regulat/i.test(all)) risks.push(['Licensing Risk', 'Medium', 'Licensing or compliance questions raised.']);
  const amounts = (all.match(/\$\s?[\d,]+/g) || []).map(x => +x.replace(/\D/g, ''));
  return {
    fit: ok.length ? Math.min(100, 40 + nReq * 10) : 0,
    ready: Math.round(['Problem', 'Objective', 'Requirement', 'Budget', 'Timeline'].filter(has).length / 5 * 100),
    value: amounts.length ? Math.min(100, Math.round(Math.max(...amounts) / 500)) : 0,
    risk: Math.min(100, risks.reduce((s, r) => s + (r[1] === 'High' ? 30 : 15), 0)), risks
  };
}
function brief(l) {
  const ok = l.reqs.filter(r => r.state === 'approved'), a = c => ok.filter(r => r.category === c).map(r => r.text);
  const open = l.reqs.filter(r => r.category === 'Open Question' && r.state !== 'rejected').map(r => r.text);
  const li = x => x.length ? '<ul>' + x.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>' : '<p class="muted">Nothing verified yet.</p>';
  return `<h2>Proposal Brief: ${esc(l.company)}</h2>` + [
    ['Customer Overview', `<p>${esc(l.company)}, contact ${esc(l.contact)}. Source: ${esc(l.source)}. Stage: ${l.stage}.</p>`],
    ['Business Problem', li(a('Problem'))],
    ['Objectives', li(a('Objective'))],
    ['Proposed Solution', li(a('Requirement'))],
    ['Scope', `<p>Covers the ${a('Requirement').length} verified requirement(s) above for these users:</p>` + li(a('Users'))],
    ['Assumptions', li([...a('Budget'), ...a('Timeline')])],
    ['Dependencies', li(a('Constraint'))],
    ['Exclusions', '<p>Anything not listed under verified requirements is out of scope until agreed in writing.</p>'],
    ['Open Questions', li(open)]
  ].map(([t, b]) => `<h3>${t}</h3>${b}`).join('');
}


let db = Store.load(), curTab = 'overview', lastId = null, filt = { q: '', stage: '' };
const view = $('#view'), dlg = $('#dlg');
const find = id => db.leads.find(l => l.id == id);
const curLead = () => find(location.hash.split('/')[2]);
$('#stageSel').innerHTML = STAGES.map(s => `<option>${s}</option>`).join('');


function dashboard() {
  setTitle('Dashboard');
  const L = db.leads, won = L.filter(l => l.stage === 'Won').length, lost = L.filter(l => l.stage === 'Lost').length;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '0%';
  const max = Math.max(1, ...STAGES.map(s => L.filter(l => l.stage === s).length));
  const fu = L.flatMap(l => l.followups.filter(f => !f.done).map(f => ({ ...f, lead: l }))).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  view.innerHTML = `<div class="grid stats">${[['Total leads', L.length], ['Conversion rate', pct(won, L.length)], ['Open opportunities', L.length - won - lost], ['Proposal success rate', pct(won, won + lost)]]
    .map(([k, v]) => `<div class="card stat"><span class="muted">${k}</span><b>${v}</b></div>`).join('')}</div>
  <div class="grid two"><div class="card"><h3>Pipeline</h3>${STAGES.map(s => { const n = L.filter(l => l.stage === s).length;
    return `<div class="meter"><span>${s}</span><div class="bar"><i style="width:${n / max * 100}%"></i></div><b>${n}</b></div>`; }).join('')}</div>
  <div class="card"><h3>Upcoming follow-ups</h3>${fu.length ? fu.map(f => `<p><a href="#/leads/${f.lead.id}">${esc(f.lead.company)}</a>: ${esc(f.action)}<br><small class="${f.due < today() ? 'bad' : 'muted'}">Due ${f.due} · ${esc(f.owner)}</small></p>`).join('') : '<p class="muted">Nothing pending.</p>'}</div></div>`;
}

const rows = () => db.leads.filter(l => (!filt.stage || l.stage === filt.stage) && (l.company + l.contact).toLowerCase().includes(filt.q.toLowerCase()))
  .map(l => `<tr class="row" data-go="${l.id}"><td><b>${esc(l.company)}</b></td><td>${esc(l.contact)}</td><td>${esc(l.source)}</td><td>${esc(l.owner)}</td><td><span class="pill ${l.stage}">${l.stage}</span></td><td>${l.created}</td></tr>`).join('')
  || '<tr><td colspan="6" class="muted">No leads found.</td></tr>';

function leadList() {
  setTitle('Leads');
  view.innerHTML = `<div class="card"><div class="toolbar"><input id="q" placeholder="Search leads…" value="${esc(filt.q)}">
  <select id="sf"><option value="">All stages</option>${STAGES.map(s => `<option ${filt.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
  <table><thead><tr><th>Company</th><th>Contact</th><th>Source</th><th>Owner</th><th>Stage</th><th>Created</th></tr></thead><tbody id="tb">${rows()}</tbody></table></div>`;
}

function fuTable(list, showLead) {
  if (!list.length) return '<p class="muted">No follow-ups yet.</p>';
  return `<table><thead><tr><th></th>${showLead ? '<th>Lead</th>' : ''}<th>Next action</th><th>Owner</th><th>Due</th></tr></thead><tbody>${
    list.sort((a, b) => a.due.localeCompare(b.due)).map(f => `<tr class="${f.done ? 'done' : ''}"><td><input type="checkbox" data-act="toggle-fu" data-id="${f.id}" ${f.done ? 'checked' : ''} aria-label="Mark complete"></td>${
      showLead ? `<td><a href="#/leads/${f.lead.id}">${esc(f.lead.company)}</a></td>` : ''}<td>${esc(f.action)}</td><td>${esc(f.owner)}</td><td class="${!f.done && f.due < today() ? 'bad' : ''}">${f.due}</td></tr>`).join('')}</tbody></table>`;
}
function followups() {
  setTitle('Follow-ups');
  view.innerHTML = `<div class="card">${fuTable(db.leads.flatMap(l => l.followups.map(f => ({ ...f, lead: l }))), true)}</div>`;
}

const tabs = {
  overview: l => `<div class="card grid info">${[['Company', l.company], ['Contact person', l.contact], ['Email', l.email], ['Phone', l.phone], ['Lead source', l.source], ['Owner', l.owner], ['Status', l.stage], ['Created', l.created]]
    .map(([k, v]) => `<div><span class="muted">${k}</span><br>${esc(v) || '-'}</div>`).join('')}</div>`,
  docs: l => `<div class="card"><h3>Upload documents (PDF, DOCX, TXT)</h3><input type="file" id="file" accept=".pdf,.docx,.txt" multiple>
    <h3 style="margin-top:16px">Or paste meeting notes</h3><textarea id="note" rows="4" placeholder="Paste meeting notes…"></textarea>
    <div class="row"><button class="btn" data-act="add-note">Save note</button><button class="btn primary" data-act="extract">Run AI extraction</button></div></div>
    <div class="card"><h3>Lead document repository</h3>${l.docs.map(d => `<p>${esc(d.name)} <small class="muted">${d.date}${d.text ? '' : ' · PDF/DOCX text is read by the server parser'}</small></p>`).join('') || '<p class="muted">No documents yet.</p>'}</div>`,
  reqs: l => !l.reqs.length ? '<div class="card muted">No findings yet. Add a document, then run AI extraction.</div>'
    : CATS.filter(c => l.reqs.some(r => r.category === c)).map(c => `<div class="card"><h3>${c}</h3>${l.reqs.filter(r => r.category === c).map(r => `<div class="req"><div>
      <span class="pill ${r.state}">${r.state}</span> <small class="muted">${Math.round(r.conf * 100)}% confidence</small><p>${esc(r.text)}</p>
      <small class="muted">Evidence: “${esc(r.ev)}” (${esc(r.src)})</small></div>
      <div class="acts"><button class="btn sm" data-act="approve" data-id="${r.id}">Approve</button><button class="btn sm" data-act="edit-req" data-id="${r.id}">Edit</button><button class="btn sm" data-act="reject" data-id="${r.id}">Reject</button></div></div>`).join('')}</div>`).join(''),
  assess: l => { const a = assess(l); return `<div class="card"><h3>Opportunity scores</h3>${[['Fit', a.fit], ['Readiness', a.ready], ['Value', a.value], ['Risk', a.risk]]
    .map(([k, v]) => `<div class="meter"><span>${k}</span><div class="bar ${k === 'Risk' ? 'risk' : ''}"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('')}
    <small class="muted">Calculated from findings that have not been rejected.</small></div>
    <div class="card"><h3>Risks</h3>${a.risks.map(r => `<p><b>${r[0]}</b> <span class="pill ${r[1]}">${r[1]}</span><br>${r[2]}</p>`).join('') || '<p class="muted">No risks flagged.</p>'}</div>`; },
  brief: l => `<div class="card noprint"><b>Draft only.</b> Built from approved findings. Review before sending to the client.
    <div class="row"><button class="btn" data-act="word">Export Word</button><button class="btn" data-act="print">Export PDF</button></div></div><div class="card" id="brief">${brief(l)}</div>`,
  fu: l => `<div class="card noprint"><form id="fuForm" class="row" style="margin:0"><input name="task" placeholder="Next action" required style="flex:2;min-width:160px">
    <input name="owner" placeholder="Owner" value="${esc(l.owner)}" style="flex:1;min-width:100px"><input name="due" type="date" required style="flex:1;min-width:140px"><button class="btn primary">Add</button></form></div>
    <div class="card">${fuTable(l.followups.map(f => ({ ...f, lead: l })), false)}</div>`
};

function detail(l) {
  setTitle(l.company);
  view.innerHTML = `<div class="head"><a href="#/leads">← All leads</a><div class="head-actions"><select data-act="stage" aria-label="Opportunity stage">${STAGES.map(s => `<option ${l.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
  <button class="btn" data-act="edit-lead">Edit</button></div></div>
  <div class="tabs">${TABS.map(([k, n]) => `<button data-act="tab" data-t="${k}" class="${curTab === k ? 'on' : ''}">${n}${k === 'reqs' && l.reqs.some(r => r.state === 'pending') ? ' •' : ''}</button>`).join('')}</div>
  <div id="tab">${tabs[curTab](l)}</div>`;
}

function route() {
  const [, page, id] = location.hash.split('/'), p = page || 'dashboard';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === p));
  if (p === 'leads' && id) {
    const l = find(id); if (!l) return (location.hash = '#/leads');
    if (id !== lastId) { curTab = 'overview'; lastId = id; }
    return detail(l);
  }
  ({ dashboard, leads: leadList, followups }[p] || dashboard)();
}

function openForm(l) {
  const f = $('#leadForm'); f.reset();
  $('#dlgTitle').textContent = l ? 'Edit lead' : 'New lead';
  f.lid.value = l ? l.id : '';
  ['company', 'contact', 'email', 'phone', 'source', 'owner', 'stage'].forEach(k => { if (l) f[k].value = l[k]; });
  dlg.showModal();
}
function exportWord(l) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['<html><head><meta charset="utf-8"></head><body>' + brief(l) + '</body></html>'], { type: 'application/msword' }));
  a.download = l.company.replace(/\W+/g, '_') + '_brief.doc'; a.click();
}


document.addEventListener('click', e => {
  const row = e.target.closest('[data-go]'); if (row) { location.hash = '#/leads/' + row.dataset.go; return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const l = curLead(), id = b.dataset.id, rq = () => l.reqs.find(r => r.id === id);
  const acts = {
    'new-lead': () => openForm(), 'edit-lead': () => openForm(l), close: () => dlg.close(),
    tab: () => { curTab = b.dataset.t; },
    approve: () => { rq().state = 'approved'; },
    reject: () => { rq().state = 'rejected'; },
    'edit-req': () => { const r = rq(), t = prompt('Edit finding', r.text); if (t && t.trim()) { r.text = t.trim(); r.state = 'approved'; } },
    'add-note': () => { const t = $('#note').value.trim(); if (!t) return toast('Write a note first');
      l.docs.push({ name: 'Meeting note ' + (l.docs.length + 1), text: t, date: today() }); toast('Note saved'); },
    extract: () => { const n = extract(l); toast(n ? n + ' findings extracted. Please review them.' : 'No new findings'); if (n) curTab = 'reqs'; },
    word: () => exportWord(l), print: () => window.print(),
    'toggle-fu': () => { db.leads.forEach(x => x.followups.forEach(f => { if (f.id === id) f.done = b.checked; })); }
  };
  if (!acts[b.dataset.act]) return;
  acts[b.dataset.act](); Store.save(); route();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sf') { filt.stage = t.value; $('#tb').innerHTML = rows(); }
  else if (t.dataset.act === 'stage') { curLead().stage = t.value; Store.save(); route(); }
  else if (t.id === 'file') {
    const l = curLead();
    Promise.all([...t.files].map(async f => ({ name: f.name, text: /\.txt$/i.test(f.name) ? await f.text() : '', date: today() })))
      .then(ds => { l.docs.push(...ds); Store.save(); route(); toast(ds.length + ' file(s) added'); });
  }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { filt.q = e.target.value; $('#tb').innerHTML = rows(); } });
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  if (f.id === 'fuForm') curLead().followups.push({ id: uid(), action: d.task, owner: d.owner, due: d.due, done: false });
  else if (f.id === 'leadForm') {
    const { lid, ...rest } = d;
    if (lid) Object.assign(find(lid), rest);
    else db.leads.push({ id: Math.max(0, ...db.leads.map(x => x.id)) + 1, ...rest, created: today(), docs: [], reqs: [], followups: [] });
    dlg.close(); toast('Lead saved');
  }
  Store.save(); route();
});
window.addEventListener('hashchange', route);
route();