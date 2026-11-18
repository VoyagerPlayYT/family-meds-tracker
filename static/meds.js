// FAMILY MEDS & HEALTH TRACKER // Production Client Logic
(function() {
  const metricLowStock = document.getElementById('metricLowStock');
  const metricDosesToday = document.getElementById('metricDosesToday');
  const membersList = document.getElementById('membersList');
  const refillItemsList = document.getElementById('refillItemsList');

  const morningMeds = document.getElementById('morningMeds');
  const afternoonMeds = document.getElementById('afternoonMeds');
  const eveningMeds = document.getElementById('eveningMeds');
  const nightMeds = document.getElementById('nightMeds');

  const viewTabs = document.querySelectorAll('.v-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const vitalsTableBody = document.getElementById('vitalsTableBody');

  // Modals
  const vitalsModal = document.getElementById('vitalsModal');
  const btnOpenVitalsModal = document.getElementById('btnOpenVitalsModal');
  const btnCloseVitalsModal = document.getElementById('btnCloseVitalsModal');
  const btnSubmitVitals = document.getElementById('btnSubmitVitals');
  const vitalMemberSelect = document.getElementById('vitalMemberSelect');
  const vitalSys = document.getElementById('vitalSys');
  const vitalDia = document.getElementById('vitalDia');
  const vitalPulse = document.getElementById('vitalPulse');
  const vitalGlucose = document.getElementById('vitalGlucose');
  const vitalNotes = document.getElementById('vitalNotes');

  const medModal = document.getElementById('medModal');
  const btnOpenAddMedModal = document.getElementById('btnOpenAddMedModal');
  const btnCloseMedModal = document.getElementById('btnCloseMedModal');
  const btnSubmitMed = document.getElementById('btnSubmitMed');
  const medMemberSelect = document.getElementById('medMemberSelect');
  const medNameInput = document.getElementById('medNameInput');
  const medDosageInput = document.getElementById('medDosageInput');
  const medPhaseSelect = document.getElementById('medPhaseSelect');
  const medMealSelect = document.getElementById('medMealSelect');
  const medStockInput = document.getElementById('medStockInput');
  const btnAddMemberModal = document.getElementById('btnAddMemberModal');

  let activeMemberId = null;
  let members = [];
  let medications = [];

  // Tab switching
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.add('hidden'));

      tab.classList.add('active');
      const pane = document.getElementById('pane' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
      if (pane) pane.classList.remove('hidden');

      if (tab.dataset.tab === 'vitals') fetchVitals();
    });
  });

  // Fetch Dashboard Stats
  async function fetchDashboard() {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      metricLowStock.textContent = `${data.low_stock_count} ALERT${data.low_stock_count === 1 ? '' : 'S'}`;
      metricDosesToday.textContent = `${data.doses_taken_today} TAKEN`;
    } catch (e) {
      console.error(e);
    }
  }

  // Fetch Members
  async function fetchMembers() {
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      members = data.members;

      // Populate selects
      vitalMemberSelect.innerHTML = '';
      medMemberSelect.innerHTML = '';
      members.forEach(m => {
        const opt1 = document.createElement('option');
        opt1.value = m.id;
        opt1.textContent = `${m.name} (${m.role})`;
        vitalMemberSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = m.id;
        opt2.textContent = `${m.name} (${m.role})`;
        medMemberSelect.appendChild(opt2);
      });

      renderMembersList();
    } catch (e) {
      console.error(e);
    }
  }

  function renderMembersList() {
    membersList.innerHTML = '';

    // "All Family" card
    const allCard = document.createElement('div');
    allCard.className = `member-card ${activeMemberId === null ? 'active' : ''}`;
    allCard.innerHTML = `<span class="member-name">Вся семья</span><span class="member-role">${members.length} профилей</span>`;
    allCard.addEventListener('click', () => {
      activeMemberId = null;
      renderMembersList();
      fetchMedications();
      fetchVitals();
    });
    membersList.appendChild(allCard);

    members.forEach(m => {
      const card = document.createElement('div');
      card.className = `member-card ${activeMemberId === m.id ? 'active' : ''}`;
      card.innerHTML = `
        <div>
          <span class="member-name">${m.name}</span>
          <span class="member-role">${m.role}, ${m.age} лет</span>
        </div>
        <div class="member-tags">
          <span class="tag-blood">${m.blood_type}</span>
          ${m.allergies && m.allergies !== 'Нет' && m.allergies !== 'None' ? `<span class="tag-allergy" title="Аллергия: ${m.allergies}">⚠️</span>` : ''}
        </div>
      `;
      card.addEventListener('click', () => {
        activeMemberId = m.id;
        renderMembersList();
        fetchMedications();
        fetchVitals();
      });
      membersList.appendChild(card);
    });
  }

  // Fetch Medications
  async function fetchMedications() {
    try {
      const url = activeMemberId ? `/api/medications?member_id=${activeMemberId}` : '/api/medications';
      const res = await fetch(url);
      const data = await res.json();
      medications = data.medications;
      renderMedications();
      renderLowStockAlerts();
    } catch (e) {
      console.error(e);
    }
  }

  function renderMedications() {
    morningMeds.innerHTML = '';
    afternoonMeds.innerHTML = '';
    eveningMeds.innerHTML = '';
    nightMeds.innerHTML = '';

    medications.forEach(m => {
      const card = document.createElement('div');
      card.className = 'med-card';
      card.innerHTML = `
        <div class="med-card-top">
          <span class="med-title">${escapeHtml(m.name)}</span>
          <span class="med-owner">${escapeHtml(m.member_name)}</span>
        </div>
        <div class="med-details">
          <span>Дозировка: <strong>${escapeHtml(m.dosage)}</strong></span>
          <span>Приём: <em>${escapeHtml(m.meal_relation)}</em></span>
        </div>
        <div class="med-actions">
          <span class="stock-tag ${m.pills_remaining <= m.low_stock_threshold ? 'text-amber' : ''}">Остаток: ${m.pills_remaining} шт</span>
          <button class="btn-take" data-id="${m.id}">✓ ПРИНЯТО</button>
        </div>
      `;

      card.querySelector('.btn-take').addEventListener('click', () => takeMedication(m.id));

      if (m.schedule_time === 'Morning') morningMeds.appendChild(card);
      else if (m.schedule_time === 'Afternoon') afternoonMeds.appendChild(card);
      else if (m.schedule_time === 'Evening') eveningMeds.appendChild(card);
      else if (m.schedule_time === 'Night') nightMeds.appendChild(card);
    });
  }

  function renderLowStockAlerts() {
    refillItemsList.innerHTML = '';
    const lowItems = medications.filter(m => m.pills_remaining <= m.low_stock_threshold);
    if (!lowItems.length) {
      refillItemsList.innerHTML = '<span class="text-muted text-xs">Все препараты в достаточном остатке.</span>';
      return;
    }

    lowItems.forEach(m => {
      const row = document.createElement('div');
      row.className = 'refill-row';
      row.innerHTML = `
        <span>${escapeHtml(m.name)} (${escapeHtml(m.member_name)})</span>
        <span class="text-amber font-mono font-bold">${m.pills_remaining} шт</span>
      `;
      refillItemsList.appendChild(row);
    });
  }

  // Take Medication
  async function takeMedication(id) {
    try {
      const res = await fetch(`/api/medications/${id}/take`, { method: 'POST' });
      if (res.ok) {
        fetchDashboard();
        fetchMedications();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Fetch Vitals
  async function fetchVitals() {
    try {
      const url = activeMemberId ? `/api/vitals?member_id=${activeMemberId}` : '/api/vitals';
      const res = await fetch(url);
      const data = await res.json();
      vitalsTableBody.innerHTML = '';

      data.vitals.forEach(v => {
        const tr = document.createElement('tr');
        let bpEval = '<span class="badge-normal">Норма</span>';
        if (v.systolic >= 140 || v.diastolic >= 90) {
          bpEval = '<span class="badge-high">Гипертония (Высокое)</span>';
        } else if (v.systolic >= 125 || v.diastolic >= 85) {
          bpEval = '<span class="badge-elevated">Повышенное</span>';
        }

        tr.innerHTML = `
          <td class="text-muted font-mono">${v.recorded_at}</td>
          <td style="font-weight:700;">${escapeHtml(v.member_name)}</td>
          <td class="font-mono">${v.systolic} / ${v.diastolic} mmHg</td>
          <td class="font-mono text-mint">${v.pulse} bpm</td>
          <td class="font-mono">${v.glucose ? v.glucose + ' mmol/L' : '—'}</td>
          <td>${bpEval}</td>
          <td style="color:#A1A1AA;">${escapeHtml(v.notes || '')}</td>
        `;
        vitalsTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Vitals Modal
  btnOpenVitalsModal.addEventListener('click', () => vitalsModal.classList.remove('hidden'));
  btnCloseVitalsModal.addEventListener('click', () => vitalsModal.classList.add('hidden'));

  btnSubmitVitals.addEventListener('click', async () => {
    const payload = {
      member_id: parseInt(vitalMemberSelect.value),
      systolic: parseInt(vitalSys.value) || 120,
      diastolic: parseInt(vitalDia.value) || 80,
      pulse: parseInt(vitalPulse.value) || 72,
      glucose: vitalGlucose.value ? parseFloat(vitalGlucose.value) : null,
      notes: vitalNotes.value.trim()
    };

    const res = await fetch('/api/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      vitalsModal.classList.add('hidden');
      fetchVitals();
    }
  });

  // Medication Modal
  btnOpenAddMedModal.addEventListener('click', () => medModal.classList.remove('hidden'));
  btnCloseMedModal.addEventListener('click', () => medModal.classList.add('hidden'));

  btnSubmitMed.addEventListener('click', async () => {
    const payload = {
      member_id: parseInt(medMemberSelect.value),
      name: medNameInput.value.trim(),
      dosage: medDosageInput.value.trim() || '1 таб.',
      schedule_time: medPhaseSelect.value,
      meal_relation: medMealSelect.value,
      pills_remaining: parseInt(medStockInput.value) || 30,
      pills_per_dose: 1,
      low_stock_threshold: 7
    };

    if (!payload.name) {
      alert("Укажите наименование препарата");
      return;
    }

    const res = await fetch('/api/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      medModal.classList.add('hidden');
      fetchMedications();
      fetchDashboard();
    }
  });

  btnAddMemberModal.addEventListener('click', async () => {
    const name = prompt("Имя члена семьи (например: Дедушка):");
    if (!name) return;
    const role = prompt("Роль (например: Дедушка):") || "Член семьи";
    const age = parseInt(prompt("Возраст:") || "65");
    const blood = prompt("Группа крови (например: O(I) Rh+):") || "Unknown";

    await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, age, blood_type: blood, allergies: 'None' })
    });
    fetchMembers();
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  // Boot
  fetchDashboard();
  fetchMembers();
  fetchMedications();

})();
