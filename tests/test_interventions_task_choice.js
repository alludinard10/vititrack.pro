const http = require('http');

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(item => item.type === 'page');
          if (page && page.webSocketDebuggerUrl) resolve(page.webSocketDebuggerUrl);
          else if (list.length > 0 && list[0].webSocketDebuggerUrl) resolve(list[0].webSocketDebuggerUrl);
          else reject(new Error('No page target found'));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    ws.onmessage = (msg) => {
      const parsed = JSON.parse(msg.data);
      if (parsed.id && this.callbacks.has(parsed.id)) {
        const { resolve, reject } = this.callbacks.get(parsed.id);
        this.callbacks.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }
}

async function run() {
  console.log('🍇 =========================================================================');
  console.log('🍇 TEST CDP : CHOISIR ET INSÉRER UN TRAVAIL VITICOLE EN INTERVENTION');
  console.log('🍇 =========================================================================\n');

  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // Navigation vers dashboard en mode Exploitation
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/dashboard.html' });
  await new Promise(r => setTimeout(r, 1500));

  await cdp.eval(`
    if (typeof switchAppMode === 'function') switchAppMode('exploitation');
    if (typeof switchExploitationView === 'function') switchExploitationView('interventions');
  `);
  await new Promise(r => setTimeout(r, 500));

  // TEST 1 : Vérifier l'affichage de la vue interventions et du sélecteur de travaux
  const step1 = await cdp.eval(`
    (() => {
      const view = document.getElementById('view-exp-interventions');
      const isVisible = view && view.style.display !== 'none';
      const select = document.getElementById('exp-int-task');
      const optGroups = select ? select.querySelectorAll('optgroup') : [];
      const hasInsertOption = select ? Array.from(select.options).some(o => o.value === '__ADD_NEW_TASK__') : false;
      return { ok: isVisible && optGroups.length > 0 && hasInsertOption, optGroupsCount: optGroups.length, hasInsertOption };
    })()
  `);
  console.log(`[1/5] ${step1.ok ? '✅' : '❌'} Structure Sélecteur Travaux avec Groupes & Option Insertion:`, step1);

  // TEST 2 : Filtrer les travaux par nature
  const step2 = await cdp.eval(`
    (() => {
      filterInterventionTasks('mecanique');
      const select = document.getElementById('exp-int-task');
      const optGroups = Array.from(select.querySelectorAll('optgroup')).map(g => g.label);
      const onlyMec = optGroups.some(l => l.includes('Mécaniques')) && !optGroups.some(l => l.includes('Manuels'));
      
      filterInterventionTasks('all');
      return { ok: onlyMec, optGroups };
    })()
  `);
  console.log(`[2/5] ${step2.ok ? '✅' : '❌'} Filtrage instantané par nature de travail:`, step2);

  // TEST 3 : Clic sur « ＋ Nouveau travail viticole » pour ouvrir la modale
  const step3 = await cdp.eval(`
    (() => {
      openAddTaskModalForIntervention();
      const modal = document.getElementById('modal-exp-task');
      const isOpen = modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      const title = document.getElementById('exp-task-modal-title')?.textContent;
      return { ok: isOpen && title.includes('intervention'), isOpen, title };
    })()
  `);
  console.log(`[3/5] ${step3.ok ? '✅' : '❌'} Ouverture de la modale d'insertion de travail:`, step3);

  // TEST 4 : Saisir et enregistrer un nouveau travail viticole
  const testTaskName = 'Épamprage de précision ' + Date.now();
  const step4 = await cdp.eval(`
    (async () => {
      document.getElementById('exp-task-nom').value = '${testTaskName}';
      document.getElementById('exp-task-work-type').value = 'manuel';
      document.getElementById('exp-task-category').value = 'Travaux manuels';
      
      await saveTask();

      const select = document.getElementById('exp-int-task');
      const selectedOption = select ? select.options[select.selectedIndex] : null;
      const isSelected = selectedOption && selectedOption.textContent.includes('${testTaskName}');

      const feedback = document.getElementById('exp-int-task-feedback');
      const feedbackShown = feedback && feedback.style.display !== 'none' && feedback.textContent.includes('${testTaskName}');

      return { ok: isSelected && feedbackShown, selectedText: selectedOption?.textContent, feedbackShown };
    })()
  `);
  console.log(`[4/5] ${step4.ok ? '✅' : '❌'} Insertion et auto-sélection immédiate dans l'intervention:`, step4);

  // TEST 5 : Vérifier que le nouveau travail est disponible dans les chips et persiste
  const step5 = await cdp.eval(`
    (() => {
      const chips = Array.from(document.querySelectorAll('#exp-int-quick-chips .task-chip'));
      const chipMatch = chips.find(c => c.textContent.includes('${testTaskName}'));
      const isChipSelected = chipMatch && chipMatch.classList.contains('selected');

      const inState = (VitiExpState.tasks || []).some(t => t.name === '${testTaskName}');
      return { ok: !!chipMatch && isChipSelected && inState, chipFound: !!chipMatch, inState };
    })()
  `);
  console.log(`[5/5] ${step5.ok ? '✅' : '❌'} Présence dans les pastilles rapides et persistance VitiExpState:`, step5);

  const allPassed = step1.ok && step2.ok && step3.ok && step4.ok && step5.ok;
  console.log('\n🍇 =========================================================================');
  console.log(`🍇 RÉSULTAT : ${allPassed ? 'TOUS LES TESTS ONT RÉUSSI (100%)' : 'ÉCHEC SUR CERTAINS TESTS'}`);
  console.log('🍇 =========================================================================\n');

  ws.close();
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
