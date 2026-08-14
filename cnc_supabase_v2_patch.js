// CNC Supabase V2 - Correctif stable
// Remplace uniquement le bloc Supabase CNC actuel, sans changer le design ni la bibliothèque.
// Table REST utilisée : public.cnc_calibrations, volontairement en minuscules.

const CNC_SUPABASE_URL = "https://exktpgmixxqgagbgkjew.supabase.co";
const CNC_SUPABASE_KEY = "sb_publishable_EnZYq5RqBLVh3R4nOsGW0A_NuEFm86V";
const CNC_SUPABASE_TABLE = "cnc_calibrations";
const CNC_SUPABASE_ENDPOINT = `${CNC_SUPABASE_URL}/rest/v1/${CNC_SUPABASE_TABLE}`;
let cncSupabaseRemoteCalibs = [];

function cncSbHeaders(extra = {}) {
  return {
    "apikey": CNC_SUPABASE_KEY,
    "Authorization": `Bearer ${CNC_SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function cncSafeText(value) {
  return String(value ?? '').replace(/[<>]/g, '');
}

function cncSelectedMaterialName() {
  try {
    const id = $('mat').value;
    return DATA[id].name[lang] || DATA[id].name.fr || id;
  } catch(e) {
    return $('mat') ? $('mat').value : '';
  }
}

function cncSelectedToolName() {
  try {
    const mid = $('mat').value;
    const tid = $('tool').value;
    return DATA[mid].tools[tid].label[lang] || DATA[mid].tools[tid].label.fr || tid;
  } catch(e) {
    return $('tool') ? $('tool').value : '';
  }
}

function cncSelectedOperationName() {
  try {
    return $('op').options[$('op').selectedIndex].text;
  } catch(e) {
    return $('op') ? $('op').value : '';
  }
}

function cncOperator() {
  return localStorage.getItem('cnc_operator') || 'Atelier FPM';
}

function cncSite() {
  return localStorage.getItem('cnc_site') || 'FPM';
}

async function saveCncCalibrationToSupabase(payload) {
  const response = await fetch(CNC_SUPABASE_ENDPOINT, {
    method: 'POST',
    headers: cncSbHeaders({ "Prefer": "return=representation" }),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`${response.status} ${txt}`);
  }
  return response.json();
}

async function loadCncSupabaseCalibrations() {
  ensureCncSupabaseCard();
  const host = document.getElementById('cncSupabaseCalibList');
  if (host) host.innerHTML = '<div class="empty">Chargement Supabase...</div>';
  try {
    const url = `${CNC_SUPABASE_ENDPOINT}?select=*&order=created_at.desc&limit=50`;
    const response = await fetch(url, {
      method: 'GET',
      headers: cncSbHeaders()
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    cncSupabaseRemoteCalibs = await response.json();
    renderCncSupabaseCalibrations();
  } catch(e) {
    if (host) host.innerHTML = `<div class="empty">Erreur Supabase V2 : ${cncSafeText(e.message)}</div>`;
  }
}

function renderCncSupabaseCalibrations() {
  ensureCncSupabaseCard();
  const host = document.getElementById('cncSupabaseCalibList');
  if (!host) return;
  if (!cncSupabaseRemoteCalibs || !cncSupabaseRemoteCalibs.length) {
    host.innerHTML = '<div class="empty">Aucune calibration CNC Supabase V2 enregistrée pour le moment.</div>';
    return;
  }

  host.innerHTML = cncSupabaseRemoteCalibs.map(r => {
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '';
    return `<div class="calib-item">
      <div class="t">${cncSafeText(r.material)} · ${cncSafeText(r.tool)}</div>
      <div class="s">${cncSafeText(r.machine)} · ${cncSafeText(r.operation)}<br>
      n=${r.spindle_rpm ?? ''} tr/min · Vf=${r.feed_rate ?? ''} mm/min<br>
      ${cncSafeText(r.site)} · ${cncSafeText(r.operator)} · ${date}${r.comments ? '<br><i>' + cncSafeText(r.comments) + '</i>' : ''}</div>
    </div>`;
  }).join('');
}

function ensureCncSupabaseCard() {
  if (document.getElementById('cncSupabaseCalibList')) return;
  const calib = document.getElementById('calib');
  if (!calib) return;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h2><span class="dot"></span>☁️ Bibliothèque Supabase CNC V2</h2>
    <div id="cncSupabaseCalibList"><div class="empty">Aucune donnée chargée.</div></div>
    <div class="btn-row">
      <button class="btn btn-ghost" type="button" onclick="loadCncSupabaseCalibrations()">↻ Recharger</button>
      <button class="btn btn-ghost" type="button" onclick="setupCncSupabaseProfile()">⚙️ Opérateur / site</button>
    </div>`;
  calib.appendChild(card);
}

function setupCncSupabaseProfile() {
  const operator = prompt('Nom opérateur / atelier', localStorage.getItem('cnc_operator') || 'Atelier FPM');
  if (operator !== null) localStorage.setItem('cnc_operator', operator.trim() || 'Atelier FPM');
  const site = prompt('Site', localStorage.getItem('cnc_site') || 'FPM');
  if (site !== null) localStorage.setItem('cnc_site', site.trim() || 'FPM');
  toast('Profil Supabase CNC V2 enregistré');
}

const saveCncCalibLocalOnly = saveCalib;
saveCalib = async function() {
  const tid = $('tool').value;
  const d = tid === 'saw' ? num('scieDiam') : num('diam');
  const Z = tid === 'saw' ? num('scieZ') : num('z');
  const n = num('cN');
  const vf = num('cVf');
  const pMin = num('cPmin');
  const pMax = num('cPmax');
  const eMin = num('cEmin');
  const eMax = num('cEmax');
  const note = $('cNote').value || '';

  if (!n || !vf) {
    toast('Valeurs ?');
    return;
  }

  saveCncCalibLocalOnly();

  try {
    await saveCncCalibrationToSupabase({
      material: cncSelectedMaterialName(),
      tool: cncSelectedToolName(),
      machine: $('machine').value,
      operation: cncSelectedOperationName(),
      spindle_rpm: n,
      feed_rate: vf,
      pass_depth_min: tid === 'saw' ? null : pMin,
      pass_depth_max: tid === 'saw' ? null : pMax,
      lateral_engagement_min: tid === 'saw' ? null : eMin,
      lateral_engagement_max: tid === 'saw' ? null : eMax,
      tool_diameter: d,
      flutes: Z,
      cutting_speed: d * Math.PI * n / 1000,
      chip_load: vf / (Z * n),
      operator: cncOperator(),
      site: cncSite(),
      comments: note
    });
    toast('Enregistré local + Supabase CNC V2');
    loadCncSupabaseCalibrations();
  } catch(e) {
    console.error('Erreur Supabase CNC V2', e);
    toast('Local OK, Supabase V2 erreur');
    ensureCncSupabaseCard();
    const host = document.getElementById('cncSupabaseCalibList');
    if (host) host.innerHTML = `<div class="empty">Erreur Supabase V2 : ${cncSafeText(e.message)}</div>`;
  }
};

setTimeout(() => {
  ensureCncSupabaseCard();
  loadCncSupabaseCalibrations();
}, 500);
