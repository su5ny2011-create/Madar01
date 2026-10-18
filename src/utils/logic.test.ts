import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  calculateFinancialSummary,
  createCustomerBookingIntoState,
  deleteMaintenanceVisitFromState,
  exportBackupJson,
  formatJod,
  generateCsvContent,
  getInitialState,
  getWeekDays,
  mergeBackupState,
  searchSystemRecords,
  syncMaintenanceVisitIntoState,
  validateAndParseBackupJson,
} from './logic.ts';

test('getInitialState starts clean with no pre-added records and admin login succeeds', () => {
  const state = getInitialState('2026-10-18');
  assert.equal(state.customers.length, 0);
  assert.equal(state.parts.length, 0);
  assert.equal(state.visits.length, 0);
  assert.equal(state.expenses.length, 0);
  assert.equal(state.morningCash.length, 0);
  assert.equal(state.appointments.length, 0);

  const adminUser = authenticateUser(state.users, 'admin', 'admin');
  assert.ok(adminUser, 'Admin user should authenticate');
  assert.equal(adminUser?.role, 'manager');

  const wrongUser = authenticateUser(state.users, 'admin', 'wrongpass');
  assert.equal(wrongUser, null);
});

test('syncMaintenanceVisitIntoState auto-creates customer, parts, weekly schedule appointments, and notification when added by manager', () => {
  const state = getInitialState('2026-10-18');
  const initialCustomerCount = state.customers.length;
  const initialNotifCount = (state.notifications || []).length;

  const updated = syncMaintenanceVisitIntoState(
    state,
    {
      id: 'visit-new-99',
      customerName: 'شركة الأفق للتقنية الحديثة',
      phone: '0790001122',
      visitType: 'contract',
      problem: 'تركيب سيرفر نسخ احتياطي',
      requiredParts: ['SSD NVMe 512GB'],
      installedParts: ['SSD NVMe 512GB', 'كابل شبكة Cat6'],
      visitDate: '2026-10-18',
      visitTime: '14:00',
      nextVisitDate: '2026-10-25',
      isPaid: true,
      amountJod: 150,
      paymentMethod: 'cash',
      isResolved: true,
      note: 'تم الإنجاز بالكامل',
      source: 'staff',
      createdAt: '2026-10-18T14:00:00Z',
    },
    { notifyOnNew: true }
  );

  // 1. Customer auto-added
  assert.equal(updated.customers.length, initialCustomerCount + 1);
  assert.equal(updated.customers[0].name, 'شركة الأفق للتقنية الحديثة');

  // 2. Parts auto-added to state.parts
  assert.equal(updated.parts.length, 2);
  assert.ok(updated.parts.some((p) => p.name === 'SSD NVMe 512GB'));
  assert.ok(updated.parts.some((p) => p.name === 'كابل شبكة Cat6'));

  // 3. Both main visit appointment and nextVisitDate appointment synced
  const mainApt = updated.appointments.find((a) => a.id === 'apt-main-visit-new-99');
  const nextApt = updated.appointments.find((a) => a.id === 'apt-next-visit-new-99');
  assert.ok(mainApt, 'Main visit appointment synced');
  assert.equal(mainApt?.date, '2026-10-18');
  assert.equal(mainApt?.status, 'completed');
  assert.ok(nextApt, 'Next visit follow-up appointment synced');
  assert.equal(nextApt?.date, '2026-10-25');

  // 4. Notification created for manager-added maintenance request
  assert.equal((updated.notifications || []).length, initialNotifCount + 1);
  assert.equal(updated.notifications![0].source, 'staff');
  assert.ok(updated.notifications![0].title.includes('شركة الأفق للتقنية الحديثة'));

  // 5. Deleting the visit removes linked appointments
  const afterDelete = deleteMaintenanceVisitFromState(updated, 'visit-new-99');
  assert.equal(
    afterDelete.appointments.filter((a) => a.linkedVisitId === 'visit-new-99').length,
    0
  );
});

test('createCustomerBookingIntoState automatically transfers customer request to maintenance, customers, calendar, and creates unread notification', () => {
  const state = getInitialState('2026-10-18');
  const initialNotifCount = (state.notifications || []).length;

  const { nextState, createdVisit, createdNotification } =
    createCustomerBookingIntoState(state, {
      customerName: 'عيادات الشفاء الطبية',
      date: '2026-10-20',
      phone: '0791234567',
      problemType: 'عطل في شبكة الإنترنت الداخلية والطابعة',
      time: '11:30',
      note: 'الرجاء الاتصال قبل الحضور',
    });

  assert.equal(createdVisit.source, 'customer_portal');
  assert.ok(
    nextState.visits.some((v) => v.id === createdVisit.id),
    'Visit added to Maintenance Requests'
  );
  assert.ok(
    nextState.customers.some((c) => c.name === 'عيادات الشفاء الطبية'),
    'Customer added to Customers catalog'
  );
  assert.ok(
    nextState.appointments.some(
      (a) => a.linkedVisitId === createdVisit.id && a.date === '2026-10-20'
    ),
    'Appointment added to Weekly Schedule Calendar'
  );
  assert.equal(
    (nextState.notifications || []).length,
    initialNotifCount + 1,
    'Notification added to notifications list'
  );
  assert.equal(createdNotification.isRead, false);
  assert.equal(createdNotification.source, 'customer_portal');
  assert.equal(createdNotification.customerName, 'عيادات الشفاء الطبية');
  assert.equal(createdNotification.linkedVisitId, createdVisit.id);
});

test('searchSystemRecords finds matching visits, customers, parts, expenses, and appointments', () => {
  const empty = getInitialState('2026-10-18');
  const state = syncMaintenanceVisitIntoState(empty, {
    id: 'visit-search-1',
    customerName: 'مستشفى الأردن التخصصي',
    phone: '0798112233',
    visitType: 'contract',
    problem: 'فحص سيرفر',
    requiredParts: ['SSD NVMe 512GB'],
    installedParts: ['SSD NVMe 512GB'],
    visitDate: '2026-10-18',
    visitTime: '10:00',
    isPaid: true,
    amountJod: 95,
    paymentMethod: 'cash',
    isResolved: true,
    source: 'staff',
    createdAt: '2026-10-18T10:00:00Z',
  });
  const hospitalResults = searchSystemRecords(state, 'مستشفى الأردن');
  assert.ok(hospitalResults.length > 0, 'Should find hospital records');
  assert.ok(hospitalResults.some((r) => r.category === 'maintenance'));
  assert.ok(hospitalResults.some((r) => r.category === 'customer'));

  const ssdResults = searchSystemRecords(state, 'SSD');
  assert.ok(ssdResults.some((r) => r.category === 'part'));
});

test('backup export, validation, and smart merge work reliably', () => {
  const state = getInitialState('2026-10-18');
  const jsonStr = exportBackupJson(state);
  assert.ok(jsonStr.includes('AL-MADAR-IT-SYSTEM'));

  const parsed = validateAndParseBackupJson(jsonStr);
  assert.equal(parsed.customers.length, state.customers.length);
  assert.equal(parsed.visits.length, state.visits.length);

  // Modify state and test smart merge
  const modifiedState = syncMaintenanceVisitIntoState(state, {
    id: 'visit-merge-test',
    customerName: 'شركة المدار الذهبي',
    phone: '0798887766',
    visitType: 'visit',
    problem: 'فحص شبكة',
    requiredParts: [],
    installedParts: [],
    visitDate: '2026-10-22',
    visitTime: '12:00',
    isPaid: false,
    amountJod: 30,
    paymentMethod: 'cash',
    isResolved: false,
    source: 'staff',
    createdAt: '2026-10-18T12:00:00Z',
  });

  const merged = mergeBackupState(modifiedState, parsed);
  assert.ok(merged.visits.some((v) => v.id === 'visit-merge-test'));
  assert.equal(merged.visits.length, state.visits.length + 1);

  assert.throws(() => validateAndParseBackupJson('{"invalid": true}'));
});

test('calculateFinancialSummary computes daily, weekly, and monthly JOD totals accurately', () => {
  const empty = getInitialState('2026-10-18');
  const withVisits = syncMaintenanceVisitIntoState(
    syncMaintenanceVisitIntoState(empty, {
      id: 'v1',
      customerName: 'زبون 1',
      visitType: 'contract',
      problem: 'صيانة 1',
      requiredParts: [],
      installedParts: [],
      visitDate: '2026-10-18',
      visitTime: '10:00',
      isPaid: true,
      amountJod: 95,
      paymentMethod: 'cash',
      isResolved: true,
      source: 'staff',
      createdAt: '2026-10-18T10:00:00Z',
    }),
    {
      id: 'v2',
      customerName: 'زبون 2',
      visitType: 'visit',
      problem: 'صيانة 2',
      requiredParts: [],
      installedParts: [],
      visitDate: '2026-10-18',
      visitTime: '12:00',
      isPaid: true,
      amountJod: 85,
      paymentMethod: 'cliq',
      isResolved: true,
      source: 'staff',
      createdAt: '2026-10-18T12:00:00Z',
    }
  );
  const state = {
    ...withVisits,
    morningCash: [
      {
        id: 'mc-1',
        date: '2026-10-18',
        amountJod: 120,
        note: 'كاش الصباح',
        recordedBy: 'admin',
      },
    ],
    expenses: [
      {
        id: 'e1',
        date: '2026-10-18',
        time: '09:00',
        category: 'fuel' as const,
        title: 'بنزين',
        amountJod: 15,
        paymentMethod: 'cash' as const,
        recordedBy: 'admin',
      },
      {
        id: 'e2',
        date: '2026-10-18',
        time: '11:00',
        category: 'parts_purchase' as const,
        title: 'شراء قطع',
        partType: 'SSD',
        amountJod: 48,
        paymentMethod: 'cash' as const,
        recordedBy: 'admin',
      },
    ],
  };

  const daily = calculateFinancialSummary(state, 'daily', '2026-10-18');

  assert.equal(daily.morningCashJod, 120);
  assert.equal(daily.totalRevenueJod, 180);
  assert.equal(daily.revenueByMethod.cash, 95);
  assert.equal(daily.revenueByMethod.cliq, 85);
  assert.equal(daily.totalExpensesJod, 63);
  assert.equal(daily.expensesByCategory.fuel, 15);
  assert.equal(daily.expensesByCategory.parts_purchase, 48);
  assert.equal(daily.netCashDrawerJod, 152);
  assert.equal(daily.netProfitJod, 117);
});

test('getWeekDays returns 7 days starting Saturday and formatJod / generateCsvContent work cleanly', () => {
  const days = getWeekDays('2026-10-18');
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-10-17');
  assert.equal(days[6], '2026-10-23');

  assert.equal(formatJod(45.5, 'ar'), '45.50 د.أ');
  assert.equal(formatJod(45.5, 'en'), '45.50 JOD');

  const state = getInitialState('2026-10-18');
  const summary = calculateFinancialSummary(state, 'monthly', '2026-10-18');
  const csv = generateCsvContent(state.visits, state.expenses, state.morningCash, summary, 'ar');
  assert.ok(csv.startsWith('\uFEFF'), 'CSV starts with UTF-8 BOM for Excel');
  assert.ok(csv.includes('شركة المدار لتجارة تكنولوجيا المعلومات'));
});
