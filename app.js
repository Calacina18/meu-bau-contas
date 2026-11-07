const DB_KEY = 'meu-bau-contas-v1';
const SETTINGS_KEY = 'meu-bau-renda-local-v1';
const INITIAL_KEY = 'meu-bau-initialized-v2';
const AIRCON_KEY = 'meu-bau-aircon-feb-2027';
const EXTRA_BILLS_KEY = 'meu-bau-extra-bills-v1';
const DEFAULT_SETTINGS = { salary: 1621, meal_voucher: 360 };
const $ = id => document.getElementById(id);
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthKey = date => date.slice(0, 7);
const monthLabel = key => { const [year, month] = key.split('-').map(Number); return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };
const dateLabel = value => { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; };
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const initialBills = [
  { id: 'renner', name: 'Fatura da Renner', amount: 81, due: '2026-11-10', paid: true, category: 'general' },
  { id: 'shopee-1', name: 'Fatura da Shopee', amount: 45, due: '2026-11-10', paid: true, category: 'general', installment: '1/3' },
  { id: 'shopee-2', name: 'Fatura da Shopee', amount: 45, due: '2026-12-10', paid: false, category: 'general', installment: '2/3' },
  { id: 'shopee-3', name: 'Fatura da Shopee', amount: 45, due: '2027-01-10', paid: false, category: 'general', installment: '3/3' },
  { id: 'nubank-nov', name: 'Fatura Nubank', amount: 30, due: '2026-11-08', paid: false, category: 'general' },
  { id: 'vivo', name: 'Fatura da Vivo', amount: 35, due: '2026-11-17', paid: false, category: 'general' },
  { id: 'nubank-dez-1', name: 'Fatura Nubank', amount: 46.28, due: '2026-12-08', paid: false, category: 'general', installment: '1/3' },
  { id: 'nubank-dez-2', name: 'Fatura Nubank', amount: 46.28, due: '2027-01-08', paid: false, category: 'general', installment: '2/3' },
  { id: 'nubank-dez-3', name: 'Fatura Nubank', amount: 46.28, due: '2027-02-08', paid: false, category: 'general', installment: '3/3' },
  { id: 'tithe-2026-11', name: 'Dízimo', amount: 165, due: '2026-11-05', paid: false, category: 'general' },
  { id: 'tithe-2026-12', name: 'Dízimo', amount: 165, due: '2026-12-05', paid: false, category: 'general' },
  { id: 'tithe-2027-01', name: 'Dízimo', amount: 165, due: '2027-01-05', paid: false, category: 'general' },
  { id: 'aircon-2026-12', name: 'Parcela do ar-condicionado', amount: 250, due: '2026-12-07', paid: false, category: 'general' },
  { id: 'aircon-2027-01', name: 'Parcela do ar-condicionado', amount: 250, due: '2027-01-07', paid: false, category: 'general' },
  { id: 'aircon-2027-02', name: 'Parcela do ar-condicionado', amount: 250, due: '2027-02-07', paid: false, category: 'general' }
];

function shiftMonth(isoDate, offset) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
function monthlyInstallments(id, name, amount, firstDue, count, firstPaid = false) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${id}-${index + 1}`,
    name,
    amount,
    due: shiftMonth(firstDue, index),
    paid: firstPaid && index === 0,
    category: 'general',
    installment: `${index + 1}/${count}`
  }));
}

const extraBills = [
  { id: 'cilios-2026-11', name: 'Fatura Cílios', amount: 130, due: '2026-11-06', paid: true, category: 'general' },
  ...monthlyInstallments('moto', 'Parcela da Moto', 490, '2026-11-05', 25, true),
  ...monthlyInstallments('gazin', 'Fatura Gazin', 55, '2026-12-10', 12),
  ...monthlyInstallments('vivo-mensal', 'Fatura Vivo', 35, '2026-12-17', 12)
];

function cleanBill(row) {
  return { ...row, amount: Number(row.amount), paid: Boolean(row.paid), category: row.category || 'general', installment: row.installment || '' };
}
function expandOldInstallments(rows) {
  const result = [];
  for (const row of rows) {
    const legacyId = String(row.id || '').match(/^(shopee|nubank-dez)-parcela-([1-3])$/);
    if (legacyId) {
      const [, source, part] = legacyId;
      result.push({ ...cleanBill(row), id: `${source}-${part}`, installment: `${part}/3` });
      continue;
    }
    const legacySeries = ['shopee', 'nubank-dez'].includes(row.id) && String(row.installments || '').startsWith('3');
    if (legacySeries) {
      for (let n = 1; n <= 3; n++) {
        const name = row.id === 'shopee' ? 'Fatura da Shopee' : 'Fatura Nubank';
        result.push({ ...row, id: `${row.id === 'shopee' ? 'shopee' : 'nubank-dez'}-${n}`, name, due: shiftMonth(row.due, n - 1), paid: n === 1 ? row.paid : false, category: row.category || 'general', installment: `${n}/3` });
      }
    } else result.push(cleanBill(row));
  }
  return result;
}

let bills = [];
const storedBills = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
const sameBill = (a, b) => a.id === b.id ||
  (a.name.trim().toLocaleLowerCase('pt-BR') === b.name.trim().toLocaleLowerCase('pt-BR') &&
    a.due === b.due && (a.amount === b.amount || (b.installment && a.installment === b.installment)));
if (Array.isArray(storedBills) && localStorage.getItem(INITIAL_KEY)) bills = expandOldInstallments(storedBills);
else if (Array.isArray(storedBills)) {
  bills = expandOldInstallments(storedBills);
  for (const bill of initialBills) if (!bills.some(item => sameBill(item, bill))) bills.push({ ...bill });
} else bills = initialBills.map(bill => ({ ...bill }));
if (!localStorage.getItem(AIRCON_KEY)) {
  const february = initialBills.find(bill => bill.id === 'aircon-2027-02');
  if (!bills.some(bill => sameBill(bill, february))) bills.push({ ...february });
  for (const bill of bills) {
    if (['aircon-2026-12', 'aircon-2027-01'].includes(bill.id) && /^[12]\/2$/.test(bill.installment)) bill.installment = '';
  }
}
if (!localStorage.getItem(EXTRA_BILLS_KEY)) {
  for (const bill of extraBills) {
    if (!bills.some(item => sameBill(item, bill))) bills.push({ ...bill });
  }
}
const oldIncome = JSON.parse(localStorage.getItem('meu-bau-renda-v1') || 'null');
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || (oldIncome ? { salary: Number(oldIncome.salary), meal_voucher: Number(oldIncome.benefit) } : { ...DEFAULT_SETTINGS });
localStorage.setItem(DB_KEY, JSON.stringify(bills));
localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
localStorage.setItem(INITIAL_KEY, 'true');
localStorage.setItem(AIRCON_KEY, 'true');
localStorage.setItem(EXTRA_BILLS_KEY, 'true');

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2400);
}
function saveBills() { localStorage.setItem(DB_KEY, JSON.stringify(bills)); render(); }
function renderReport() {
  const months = [...new Set(bills.map(bill => monthKey(bill.due)))].sort();
  const select = $('reportMonth'), previous = select.value;
  select.innerHTML = months.map(month => `<option value="${month}">${monthLabel(month)}</option>`).join('');
  if (!months.length) select.innerHTML = '<option value="">Sem contas</option>';
  else select.value = months.includes(previous) ? previous : months[0];
  const items = bills.filter(bill => monthKey(bill.due) === select.value);
  const paid = items.filter(bill => bill.paid), open = items.filter(bill => !bill.paid);
  $('monthTotal').textContent = money(items.reduce((sum, bill) => sum + bill.amount, 0));
  $('monthPaid').textContent = money(paid.reduce((sum, bill) => sum + bill.amount, 0));
  $('monthDue').textContent = money(open.reduce((sum, bill) => sum + bill.amount, 0));
  $('paidList').innerHTML = paid.length ? paid.map(bill => `<div class="paid-line"><span>${safe(bill.name)}${bill.installment ? ` · parcela ${safe(bill.installment)}` : ''}</span><b>${money(bill.amount)}</b></div>`).join('') : 'Nenhuma conta paga neste mês.';
  return { items, open };
}
function render() {
  const { items, open } = renderReport();
  const regular = items.filter(bill => bill.category !== 'meal').reduce((sum, bill) => sum + bill.amount, 0);
  const meals = items.filter(bill => bill.category === 'meal').reduce((sum, bill) => sum + bill.amount, 0);
  $('salaryLeft').textContent = money(settings.salary - regular);
  $('mealLeft').textContent = money(settings.meal_voucher - meals);
  $('openTotal').textContent = money(open.reduce((sum, bill) => sum + bill.amount, 0));
  $('openCount').textContent = `${open.length} ${open.length === 1 ? 'conta em aberto' : 'contas em aberto'}`;
  const filter = $('statusFilter').value, query = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const visible = bills.filter(bill => (filter === 'all' || (filter === 'paid') === bill.paid) && bill.name.toLocaleLowerCase('pt-BR').includes(query)).sort((a, b) => a.due.localeCompare(b.due));
  if (!visible.length) { $('billList').innerHTML = '<div class="empty">Seu baú está vazio por aqui. Adicione uma conta ou ajuste a busca.</div>'; return; }
  const grouped = new Map();
  for (const bill of visible) { const month = monthKey(bill.due); if (!grouped.has(month)) grouped.set(month, []); grouped.get(month).push(bill); }
  $('billList').innerHTML = [...grouped].map(([month, rows]) => `<h3 class="month-label">${monthLabel(month)}</h3><div class="bill-list">${rows.map(bill => `<article class="bill ${bill.paid ? 'paid' : ''}"><input class="check" type="checkbox" data-paid="${safe(bill.id)}" aria-label="Marcar ${safe(bill.name)} como paga" ${bill.paid ? 'checked' : ''}><div><div class="merchant">${safe(bill.name)}${bill.installment ? ` <span class="pill">Parcela ${safe(bill.installment)}</span>` : ''}${bill.category === 'meal' ? ' <span class="pill">Refeição</span>' : ''}</div><div class="detail">Vence em ${dateLabel(bill.due)}${bill.paid ? ' · Paga' : ''}</div></div><div class="amount">${money(bill.amount)}</div><div class="actions"><button class="icon-button" data-edit="${safe(bill.id)}" aria-label="Editar conta">✎</button><button class="icon-button" data-delete="${safe(bill.id)}" aria-label="Excluir conta">⌫</button></div></article>`).join('')}</div>`).join('');
}
function findBill(id) { return bills.find(bill => bill.id === id); }
function openBillDialog(bill = null) {
  $('billForm').reset(); $('billId').value = bill?.id || ''; $('billTitle').textContent = bill ? 'Editar conta' : 'Nova conta';
  $('billCount').value = 1; $('billCount').disabled = Boolean(bill);
  $('billPaid').value = String(Boolean(bill?.paid)); $('billCategory').value = bill?.category || 'general';
  if (bill) { $('billName').value = bill.name; $('billAmount').value = bill.amount; $('billDue').value = bill.due; }
  $('billDialog').showModal();
}

$('addBtn').addEventListener('click', () => openBillDialog());
$('incomeBtn').addEventListener('click', () => { $('salaryInput').value = settings.salary; $('mealInput').value = settings.meal_voucher; $('incomeDialog').showModal(); });
$('incomeForm').addEventListener('submit', event => {
  event.preventDefault();
  settings = { salary: Number($('salaryInput').value), meal_voucher: Number($('mealInput').value) };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  $('incomeDialog').close(); render(); toast('Renda atualizada.');
});
$('billForm').addEventListener('submit', event => {
  event.preventDefault();
  const id = $('billId').value, amount = Number($('billAmount').value), due = $('billDue').value, count = Number($('billCount').value);
  const name = $('billName').value.trim(), category = $('billCategory').value, firstPaid = $('billPaid').value === 'true';
  if (id) {
    const bill = findBill(id);
    Object.assign(bill, { name, amount, due, category, paid: firstPaid });
  } else {
    const group = crypto.randomUUID();
    for (let n = 1; n <= count; n++) bills.push({ id: crypto.randomUUID(), name, amount, due: shiftMonth(due, n - 1), category, paid: firstPaid && n === 1, installment: count > 1 ? `${n}/${count}` : '', group_id: count > 1 ? group : null });
  }
  saveBills(); $('billDialog').close(); toast(id ? 'Conta atualizada.' : count > 1 ? `${count} parcelas salvas nos meses correspondentes.` : 'Conta salva.');
});
$('billList').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]');
  if (edit) openBillDialog(findBill(edit.dataset.edit));
  if (remove) {
    const bill = findBill(remove.dataset.delete);
    if (bill && confirm(`Excluir “${bill.name}${bill.installment ? ` · parcela ${bill.installment}` : ''}”?`)) {
      bills = bills.filter(item => item.id !== bill.id); saveBills(); toast('Conta excluída.');
    }
  }
});
$('billList').addEventListener('change', event => {
  const input = event.target.closest('[data-paid]'); if (!input) return;
  const bill = findBill(input.dataset.paid); if (bill) { bill.paid = input.checked; saveBills(); toast(bill.paid ? 'Conta marcada como paga.' : 'Conta voltou para em aberto.'); }
});
$('statusFilter').addEventListener('change', render);
$('search').addEventListener('input', render);
$('reportMonth').addEventListener('change', render);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text()), imported = Array.isArray(data) ? data : data.bills;
    if (!Array.isArray(imported) || !imported.length) throw new Error('O arquivo não contém contas.');
    if (!confirm(`Substituir as contas atuais pelas ${imported.length} contas do arquivo?`)) return;
    const rows = expandOldInstallments(imported).map((row, index) => ({ ...cleanBill(row), id: row.id || `import-${Date.now()}-${index}`, due: row.due }));
    if (rows.some(row => !row.name || !Number.isFinite(row.amount) || !/^\d{4}-\d{2}-\d{2}$/.test(row.due))) throw new Error('Revise nomes, valores e datas do arquivo.');
    bills = rows;
    if (data.salary !== undefined || data.meal_voucher !== undefined) settings = { salary: Number(data.salary ?? settings.salary), meal_voucher: Number(data.meal_voucher ?? settings.meal_voucher) };
    localStorage.setItem(DB_KEY, JSON.stringify(bills)); localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); render(); toast('Backup restaurado neste aparelho.');
  } catch (error) { toast(error.message); }
  finally { event.target.value = ''; }
});
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), salary: settings.salary, meal_voucher: settings.meal_voucher, bills }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'meu-bau-backup.json'; link.click(); URL.revokeObjectURL(url);
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
render();
