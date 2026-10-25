import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppState } from '../types.ts';
import {
  archiveVisitsIntoState,
  authenticateUser,
  autoArchivePastDayVisits,
  autoArchivePastDayFinance,
  calculateFinancialSummary,
  createCustomerBookingIntoState,
  deleteMaintenanceVisitFromState,
  exportBackupJson,
  formatJod,
  generateCsvContent,
  getInitialState,
  getWeekDays,
  mergeBackupState,
  restoreDayFinanceToActive,
  restoreFinanceRecordToActive,
  searchSystemRecords,
  syncMaintenanceVisitIntoState,
  transferDailyFinanceToAdvanced,
  transferProfitsToMorningCash,
  unarchiveVisitFromState,
  unarchiveVisitsFromState,
  validateAndParseBackupJson,
  isVisitUnpaid,
  generatePaymentReminderMessage,
  formatWhatsAppUrl,
  resetSystemDataState,
  syncCashAdvanceIntoState,
  deleteCashAdvanceFromState,
  calculateCliqAccountMetrics,
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

  // 5. Deleting the visit removes the visit, linked appointments, and linked notifications
  const afterDelete = deleteMaintenanceVisitFromState(updated, 'visit-new-99');
  assert.equal(
    afterDelete.visits.filter((v) => v.id === 'visit-new-99').length,
    0
  );
  assert.equal(
    afterDelete.appointments.filter((a) => a.linkedVisitId === 'visit-new-99').length,
    0
  );
  assert.equal(
    (afterDelete.notifications || []).filter((n) => n.linkedVisitId === 'visit-new-99').length,
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
      visitType: 'visit',
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

test('autoArchivePastDayVisits and archiveVisitsIntoState archive requests to Daily Maintenance without losing data', () => {
  const empty = getInitialState('2026-10-18');
  const s1 = syncMaintenanceVisitIntoState(empty, {
    id: 'v-past',
    customerName: 'شركة الرواد',
    visitType: 'visit',
    problem: 'صيانة طابعة ليزر',
    requiredParts: ['حبر طابعة'],
    installedParts: ['حبر طابعة'],
    visitDate: '2026-10-17',
    visitTime: '09:30',
    isPaid: true,
    amountJod: 45,
    paymentMethod: 'cash',
    isResolved: false,
    source: 'staff',
    createdAt: '2026-10-17T09:30:00Z',
  });
  const s2 = syncMaintenanceVisitIntoState(s1, {
    id: 'v-today-done',
    customerName: 'مؤسسة النجاح',
    visitType: 'visit',
    problem: 'فحص شبكة',
    requiredParts: [],
    installedParts: ['كابل Cat6'],
    visitDate: '2026-10-18',
    visitTime: '13:00',
    isPaid: true,
    amountJod: 75,
    paymentMethod: 'cliq',
    isResolved: true,
    source: 'staff',
    createdAt: '2026-10-18T13:00:00Z',
  });

  // 1. End of day auto-archive moves past-day visit (2026-10-17 < 2026-10-18) automatically
  const autoRes = autoArchivePastDayVisits(s2, '2026-10-18');
  assert.equal(autoRes.archivedCount, 1);
  const pastVisit = autoRes.state.visits.find((v) => v.id === 'v-past');
  assert.equal(pastVisit?.isArchived, true);
  assert.equal(pastVisit?.amountJod, 45);
  assert.deepEqual(pastVisit?.installedParts, ['حبر طابعة']);

  // 2. Manual transfer of completed visits moves today's resolved visit
  const manualRes = archiveVisitsIntoState(autoRes.state, undefined, '2026-10-18');
  assert.equal(manualRes.archivedCount, 1);
  const todayDone = manualRes.state.visits.find((v) => v.id === 'v-today-done');
  assert.equal(todayDone?.isArchived, true);
  assert.equal(todayDone?.amountJod, 75);

  // 3. Financial summary preserves 100% of revenue across archived visits
  const allSummary = calculateFinancialSummary(manualRes.state, 'all', '2026-10-18');
  assert.equal(allSummary.totalRevenueJod, 120);

  // 4. Restoring a visit marks it active and prevents immediate re-archiving
  const restored = unarchiveVisitFromState(manualRes.state, 'v-past');
  const restoredVisit = restored.visits.find((v) => v.id === 'v-past');
  assert.equal(restoredVisit?.isArchived, false);
  assert.equal(restoredVisit?.autoArchiveExcluded, true);

  // 5. Restoring multiple visits at once via unarchiveVisitsFromState
  const bulkRestored = unarchiveVisitsFromState(manualRes.state, ['v-past', 'v-today-done']);
  assert.equal(bulkRestored.restoredCount, 2);
  assert.equal(bulkRestored.state.visits.every((v) => !v.isArchived), true);
});

test('periodic contract visit is always unpaid (amountJod=0, isPaid=false) and finance transfers work between pages', () => {
  const empty = getInitialState('2026-10-18');
  const withContract = syncMaintenanceVisitIntoState(empty, {
    id: 'v-contract-1',
    customerName: 'شركة الأفق',
    visitType: 'contract',
    problem: 'زيارة صيانة دورية شهرية',
    requiredParts: [],
    installedParts: [],
    visitDate: '2026-10-18',
    visitTime: '10:00',
    isPaid: true,
    amountJod: 100,
    paymentMethod: 'cash',
    isResolved: true,
    source: 'staff',
    createdAt: '2026-10-18T10:00:00Z',
  });

  const savedContract = withContract.visits.find((v) => v.id === 'v-contract-1');
  assert.equal(savedContract?.amountJod, 0);
  assert.equal(savedContract?.isPaid, false);

  // Add a paid single visit, morning cash, and expense, then test selective and bulk transfer to Advanced Finance
  const withPaidVisit = syncMaintenanceVisitIntoState(withContract, {
    id: 'v-paid-1',
    customerName: 'عيادة الشفاء',
    visitType: 'visit',
    problem: 'تركيب راوتر',
    requiredParts: [],
    installedParts: ['راوتر'],
    visitDate: '2026-10-18',
    visitTime: '11:00',
    isPaid: true,
    amountJod: 40,
    paymentMethod: 'cash',
    isResolved: true,
    source: 'staff',
    createdAt: '2026-10-18T11:00:00Z',
  });

  const stateWithFinance = {
    ...withPaidVisit,
    morningCash: [
      { id: 'mc-10', date: '2026-10-18', amountJod: 50, recordedBy: 'admin' },
    ],
    expenses: [
      {
        id: 'exp-10',
        date: '2026-10-18',
        time: '12:00',
        category: 'fuel' as const,
        title: 'بنزين سيارة',
        amountJod: 10,
        paymentMethod: 'cash' as const,
        recordedBy: 'admin',
      },
    ],
  };

  // Transfer selected IDs (morning cash + expense)
  const selTransfer = transferDailyFinanceToAdvanced(
    stateWithFinance,
    { ids: ['mc-10', 'exp-10'] },
    '2026-10-18'
  );
  assert.equal(selTransfer.transferredCount, 2);
  assert.equal(selTransfer.state.morningCash[0].isArchived, true);
  assert.equal(selTransfer.state.expenses[0].isArchived, true);

  // Transfer remaining active finance (v-paid-1; contract visit is ignored)
  const bulkTransfer = transferDailyFinanceToAdvanced(
    selTransfer.state,
    undefined,
    '2026-10-18'
  );
  assert.equal(bulkTransfer.transferredCount, 1);
  assert.equal(
    bulkTransfer.state.visits.find((v) => v.id === 'v-paid-1')?.isFinanceArchived,
    true
  );

  // Restore single finance record and full day finance
  const afterSingleRestore = restoreFinanceRecordToActive(
    bulkTransfer.state,
    'expense',
    'exp-10'
  );
  assert.equal(afterSingleRestore.expenses[0].isArchived, false);

  const afterDayRestore = restoreDayFinanceToActive(
    afterSingleRestore,
    '2026-10-18'
  );
  assert.equal(afterDayRestore.morningCash[0].isArchived, false);
  assert.equal(
    afterDayRestore.visits.find((v) => v.id === 'v-paid-1')?.isFinanceArchived,
    false
  );
});

test('editing daily maintenance requests updates fields properly while preserving archive status without data loss', () => {
  const state = getInitialState('2026-10-18');
  const s1 = syncMaintenanceVisitIntoState(state, {
    id: 'archived-visit-101',
    customerName: 'مطعم القدس',
    visitType: 'visit',
    problem: 'عطل كاميرات المراقبة',
    requiredParts: ['محول 12V'],
    installedParts: [],
    visitDate: '2026-10-15',
    visitTime: '11:00',
    isPaid: false,
    amountJod: 30,
    paymentMethod: 'cash',
    isResolved: false,
    source: 'staff',
    createdAt: '2026-10-15T11:00:00Z',
    isArchived: true,
    archivedAt: '2026-10-15T23:59:59Z',
  });

  // Edit the daily maintenance request with updated parts, notes, amount, and resolution
  const updatedVisit = {
    ...s1.visits[0],
    problem: 'تم فحص الكاميرات واستبدال المحول وإصلاح الكونيكتور',
    installedParts: ['محول 12V 2A', 'BNC Connector'],
    amountJod: 40,
    isPaid: true,
    paymentMethod: 'cliq' as const,
    isResolved: true,
    note: 'ملاحظات مفرغة من ورقة العمل: الجهاز يعمل بامتياز وتم تسليم الوصل',
  };

  const s2 = syncMaintenanceVisitIntoState(s1, updatedVisit);
  const found = s2.visits.find((v) => v.id === 'archived-visit-101');

  assert.ok(found, 'Visit should exist');
  assert.equal(found?.isArchived, true, 'isArchived should remain true');
  assert.equal(found?.problem, 'تم فحص الكاميرات واستبدال المحول وإصلاح الكونيكتور');
  assert.deepEqual(found?.installedParts, ['محول 12V 2A', 'BNC Connector']);
  assert.equal(found?.amountJod, 40);
  assert.equal(found?.isPaid, true);
  assert.equal(found?.paymentMethod, 'cliq');
  assert.equal(found?.isResolved, true);
  assert.equal(
    found?.note,
    'ملاحظات مفرغة من ورقة العمل: الجهاز يعمل بامتياز وتم تسليم الوصل'
  );
});

test('cancelling daily work after addition removes work note and visit cleanly without leaving orphans', () => {
  const s0 = getInitialState('2026-10-20');

  // Add work note
  const noteRecord = {
    id: 'note-today-1',
    date: '2026-10-20',
    title: 'تركيب راوتر وتمديد كابل',
    content: 'تفاصيل العمل اليومي تم الانتهاء بنجاح',
    isPinned: true,
    isCompleted: false,
    author: 'أحمد الفني',
    createdAt: '2026-10-20',
  };
  const s1 = { ...s0, dailyNotes: [noteRecord, ...s0.dailyNotes] };
  assert.equal(s1.dailyNotes.length, 1);

  // Undo / Cancel work note
  const s2 = { ...s1, dailyNotes: s1.dailyNotes.filter((n) => n.id !== 'note-today-1') };
  assert.equal(s2.dailyNotes.length, 0, 'Work note successfully cancelled/undone');

  // Add maintenance visit for today with locked technician
  const loggedInTech = 'أحمد الفني - شركة المدار';
  const visitToday = {
    id: 'visit-today-1',
    customerName: 'محلات القدس للتجارة',
    phone: '0795554433',
    visitType: 'visit' as const,
    problem: 'تصليح كمبيوتر نقطة بيع',
    technicianName: loggedInTech,
    visitDate: '2026-10-20',
    visitTime: '11:00',
    requiredParts: [],
    installedParts: [],
    amountJod: 25,
    paymentMethod: 'cash' as const,
    isPaid: true,
    status: 'pending' as const,
    isResolved: false,
    source: 'staff' as const,
    createdAt: '2026-10-20',
  };
  const s3 = syncMaintenanceVisitIntoState(s2, visitToday);
  assert.equal(s3.visits.length, 1);
  assert.equal(s3.visits[0].technicianName, loggedInTech, 'Technician name strictly matches logged in user');

  // Undo / cancel visit today
  const s4 = deleteMaintenanceVisitFromState(s3, 'visit-today-1');
  assert.equal(s4.visits.length, 0, 'Visit successfully cancelled');
  assert.equal(s4.appointments.filter((a) => a.linkedVisitId === 'visit-today-1').length, 0);
});

test('transferProfitsToMorningCash rolls over active financial accounts and net profits into Morning Cash', () => {
  const s0 = getInitialState('2026-10-21');
  const s1 = syncMaintenanceVisitIntoState(s0, {
    id: 'v-prof-1',
    customerName: 'شركة النور',
    visitType: 'visit',
    problem: 'تركيب سيرفر',
    requiredParts: [],
    installedParts: [],
    visitDate: '2026-10-21',
    visitTime: '10:00',
    isPaid: true,
    amountJod: 85,
    paymentMethod: 'cash',
    isResolved: true,
    source: 'staff',
    createdAt: '2026-10-21',
  });

  const s2 = {
    ...s1,
    morningCash: [
      { id: 'mc-open-1', date: '2026-10-21', amountJod: 50, recordedBy: 'admin' },
    ],
    expenses: [
      {
        id: 'exp-prof-1',
        date: '2026-10-21',
        time: '12:00',
        category: 'fuel' as const,
        title: 'بنزين',
        amountJod: 15,
        paymentMethod: 'cash' as const,
        recordedBy: 'admin',
      },
    ],
  };

  // Rollover active profits (85 - 15 = +70 JOD) into existing Morning Cash (50 JOD -> 120 JOD)
  const rollover = transferProfitsToMorningCash(s2, { source: 'active' }, '2026-10-21');
  assert.equal(rollover.transferredCount, 2);
  assert.equal(rollover.revenueJod, 85);
  assert.equal(rollover.expensesJod, 15);
  assert.equal(rollover.netProfitJod, 70);
  assert.equal(rollover.previousMorningCashJod, 50);
  assert.equal(rollover.newMorningCashJod, 120);

  const activeMc = rollover.state.morningCash.filter((m) => !m.isArchived);
  assert.equal(activeMc.length, 1);
  assert.equal(activeMc[0].amountJod, 120);
  assert.equal(rollover.state.visits[0].isFinanceArchived, true);
  assert.equal(rollover.state.expenses[0].isArchived, true);
});

test('isVisitUnpaid and generatePaymentReminderMessage accurately identify unpaid visits and format messages', () => {
  const unpaidVisit = {
    id: 'v-unpaid-1',
    customerName: 'مختبرات الشفاء',
    phone: '0798917539',
    visitType: 'visit' as const,
    problem: 'صيانة شبكة وسيرفر',
    requiredParts: [],
    installedParts: ['سويتش 8 بورت'],
    visitDate: '2026-10-21',
    visitTime: '11:30',
    isPaid: false,
    amountJod: 45,
    paymentMethod: 'cliq' as const,
    isResolved: true,
    source: 'staff' as const,
    createdAt: '2026-10-21',
  };
  const paidVisit = {
    ...unpaidVisit,
    id: 'v-paid-1',
    isPaid: true,
  };

  assert.equal(isVisitUnpaid(unpaidVisit), true);
  assert.equal(isVisitUnpaid(paidVisit), false);

  const politeAr = generatePaymentReminderMessage({
    customerName: 'مختبرات الشفاء',
    visits: [unpaidVisit],
    lang: 'ar',
    style: 'polite',
  });
  assert.ok(politeAr.includes('مختبرات الشفاء'));
  assert.ok(politeAr.includes('45.00'));
  assert.ok(politeAr.includes('صيانة شبكة وسيرفر'));

  const detailedEn = generatePaymentReminderMessage({
    customerName: 'Al Shifa Labs',
    visits: [unpaidVisit],
    lang: 'en',
    style: 'detailed',
  });
  assert.ok(detailedEn.includes('Al Shifa Labs'));
  assert.ok(detailedEn.includes('45.00 JOD'));
  assert.ok(detailedEn.includes('CliQ'));

  const waUrl = formatWhatsAppUrl('0798917539', politeAr);
  assert.ok(waUrl.startsWith('https://wa.me/962798917539?text='));
});

test('resetSystemDataState clears all added data while preserving user login accounts', () => {
  const s0 = getInitialState('2026-10-21');
  const s1 = syncMaintenanceVisitIntoState(s0, {
    id: 'v-reset-1',
    customerName: 'زبون تجريبي',
    visitType: 'visit',
    problem: 'عطل طابعة',
    requiredParts: [],
    installedParts: [],
    visitDate: '2026-10-21',
    visitTime: '09:00',
    isPaid: false,
    amountJod: 20,
    paymentMethod: 'cash',
    isResolved: false,
    source: 'staff',
    createdAt: '2026-10-21',
  });
  assert.equal(s1.visits.length, 1);
  assert.equal(s1.customers.length, 1);

  const cleared = resetSystemDataState(s1);
  assert.equal(cleared.visits.length, 0);
  assert.equal(cleared.customers.length, 0);
  assert.equal(cleared.parts.length, 0);
  assert.equal(cleared.purchases?.length, 0);
  assert.equal(cleared.expenses.length, 0);
  assert.equal(cleared.morningCash.length, 0);
  assert.equal(cleared.appointments.length, 0);
  assert.ok(cleared.users.length >= 1, 'User accounts are preserved');
});

test('autoArchivePastDayVisits and autoArchivePastDayFinance automatically archive after day ends', () => {
  const base = getInitialState('2026-10-22');
  const withData: AppState = {
    ...base,
    visits: [
      {
        id: 'v-yesterday',
        customerName: 'زبون الأمس',
        visitType: 'visit',
        problem: 'صيانة قديمة',
        requiredParts: [],
        installedParts: [],
        visitDate: '2026-10-21',
        visitTime: '10:00',
        isPaid: true,
        amountJod: 50,
        paymentMethod: 'cash',
        isResolved: true,
        source: 'staff',
        createdAt: '2026-10-21',
        isArchived: false,
        isFinanceArchived: false,
      },
      {
        id: 'v-today',
        customerName: 'زبون اليوم',
        visitType: 'visit',
        problem: 'صيانة اليوم',
        requiredParts: [],
        installedParts: [],
        visitDate: '2026-10-22',
        visitTime: '11:00',
        isPaid: false,
        amountJod: 30,
        paymentMethod: 'cash',
        isResolved: false,
        source: 'staff',
        createdAt: '2026-10-22',
        isArchived: false,
      },
    ],
    expenses: [
      {
        id: 'exp-yesterday',
        date: '2026-10-21',
        time: '12:00',
        category: 'fuel',
        title: 'بنزين الأمس',
        amountJod: 10,
        paymentMethod: 'cash',
        recordedBy: 'admin',
        isArchived: false,
      },
      {
        id: 'exp-today',
        date: '2026-10-22',
        time: '14:00',
        category: 'fuel',
        title: 'بنزين اليوم',
        amountJod: 15,
        paymentMethod: 'cash',
        recordedBy: 'admin',
        isArchived: false,
      },
    ],
    morningCash: [
      {
        id: 'mc-yesterday',
        date: '2026-10-21',
        amountJod: 100,
        recordedBy: 'admin',
        isArchived: false,
      },
    ],
  };

  // 1. Run auto-archive for visits on 2026-10-22
  const vRes = autoArchivePastDayVisits(withData, '2026-10-22');
  assert.equal(vRes.archivedCount, 1);
  const yVisit = vRes.state.visits.find((v) => v.id === 'v-yesterday');
  const tVisit = vRes.state.visits.find((v) => v.id === 'v-today');
  assert.equal(yVisit?.isArchived, true, 'Yesterday visit archived to Old Requests');
  assert.equal(tVisit?.isArchived, false, 'Today visit remains active');

  // 2. Run auto-archive for finance on 2026-10-22
  const fRes = autoArchivePastDayFinance(vRes.state, '2026-10-22');
  assert.equal(fRes.archivedCount, 3); // 1 morning cash + 1 expense + 1 paid visit revenue
  const yExp = fRes.state.expenses.find((e) => e.id === 'exp-yesterday');
  const tExp = fRes.state.expenses.find((e) => e.id === 'exp-today');
  const yMc = fRes.state.morningCash.find((m) => m.id === 'mc-yesterday');
  assert.equal(yExp?.isArchived, true, 'Yesterday expense archived to Advanced Finance');
  assert.equal(tExp?.isArchived, false, 'Today expense remains active');
  assert.equal(yMc?.isArchived, true, 'Yesterday morning cash archived to Advanced Finance');
  const yVisitFin = fRes.state.visits.find((v) => v.id === 'v-yesterday');
  assert.equal(yVisitFin?.isFinanceArchived, true, 'Yesterday visit revenue archived to Advanced Finance');

  // Automatic rollover into active morning cash for today
  const todayActiveMc = fRes.state.morningCash.find((m) => m.date === '2026-10-22' && !m.isArchived);
  assert.ok(todayActiveMc, 'Automatic morning cash created for today');
  assert.ok(todayActiveMc.amountJod > 0, 'Rolled-over morning cash has positive balance');
  assert.ok((todayActiveMc.note || '').includes('ترحيل تلقائي'), 'Note reflects automatic end-of-day rollover');
});

test('advanced finance day grouping and expense distribution calculates categories accurately', () => {
  const expenses = [
    {
      id: 'e-1',
      date: '2026-10-21',
      title: 'بنزين لسيارة الصيانة',
      category: 'fuel' as const,
      amountJod: 20,
      paymentMethod: 'cash' as const,
      isArchived: true,
      createdAt: '2026-10-21T09:00:00Z',
    },
    {
      id: 'e-2',
      date: '2026-10-21',
      title: 'تصليح بنشر إطار',
      category: 'car_repair' as const,
      amountJod: 15,
      paymentMethod: 'cash' as const,
      isArchived: true,
      createdAt: '2026-10-21T10:00:00Z',
    },
    {
      id: 'e-3',
      date: '2026-10-20',
      title: 'شراء قطع صيانة',
      category: 'parts_purchase' as const,
      amountJod: 40,
      paymentMethod: 'cliq' as const,
      isArchived: true,
      createdAt: '2026-10-20T12:00:00Z',
    },
  ];

  const dates = Array.from(new Set(expenses.map((e) => e.date))).sort((a, b) => b.localeCompare(a));
  assert.deepEqual(dates, ['2026-10-21', '2026-10-20']);

  const day21 = expenses.filter((e) => e.date === '2026-10-21');
  const fuel21 = day21.filter((e) => e.category === 'fuel').reduce((acc, e) => acc + e.amountJod, 0);
  const repair21 = day21.filter((e) => e.category === 'car_repair').reduce((acc, e) => acc + e.amountJod, 0);
  const parts21 = day21.filter((e) => e.category === 'parts_purchase').reduce((acc, e) => acc + e.amountJod, 0);

  assert.equal(fuel21, 20);
  assert.equal(repair21, 15);
  assert.equal(parts21, 0);
  assert.equal(fuel21 + repair21 + parts21, 35);
});

test('syncCashAdvanceIntoState and deleteCashAdvanceFromState deduct from cash drawer and support edit and delete for all users', () => {
  const s0 = getInitialState('2026-10-25');
  const sWithCash: AppState = {
    ...s0,
    users: [
      ...s0.users,
      {
        id: 'user-abdullah',
        username: 'abdullah',
        password: '123',
        fullName: 'عبدالله',
        role: 'technician',
        active: true,
        createdAt: '2026-10-25',
      },
    ],
    morningCash: [
      {
        id: 'mc-1',
        date: '2026-10-25',
        amountJod: 100,
        recordedBy: 'admin',
      },
    ],
  };

  // Before advance: 100 JOD in cash drawer
  const summaryBefore = calculateFinancialSummary(sWithCash, 'daily', '2026-10-25');
  assert.equal(summaryBefore.netCashDrawerJod, 100);

  // 1. Abdullah takes a 25 JOD cash advance
  const s1 = syncCashAdvanceIntoState(sWithCash, {
    id: 'adv-1',
    userId: 'user-abdullah',
    userFullName: 'عبدالله',
    username: 'abdullah',
    amountJod: 25,
    date: '2026-10-25',
    time: '11:30',
    note: 'سلفة من الكاش',
    recordedBy: 'عبدالله',
    createdAt: '2026-10-25T11:30:00Z',
  });

  assert.equal((s1.cashAdvances || []).length, 1);
  assert.equal(s1.expenses.length, 1);
  assert.equal(s1.expenses[0].amountJod, 25);
  assert.equal(s1.expenses[0].paymentMethod, 'cash');
  assert.equal(s1.expenses[0].linkedCashAdvanceId, 'adv-1');

  const summaryAfterAdvance = calculateFinancialSummary(s1, 'daily', '2026-10-25');
  assert.equal(summaryAfterAdvance.netCashDrawerJod, 75, '25 JOD deducted from cash drawer');

  // 2. Edit Abdullah advance from 25 JOD to 40 JOD
  const s2 = syncCashAdvanceIntoState(s1, {
    ...(s1.cashAdvances![0]),
    amountJod: 40,
    note: 'تعديل قيمة السلفة من الكاش',
  });

  assert.equal((s2.cashAdvances || []).length, 1);
  assert.equal(s2.expenses.length, 1);
  assert.equal(s2.expenses[0].amountJod, 40);

  const summaryAfterEdit = calculateFinancialSummary(s2, 'daily', '2026-10-25');
  assert.equal(summaryAfterEdit.netCashDrawerJod, 60, 'Updated 40 JOD deducted from cash drawer');

  // 3. Delete Abdullah advance and verify cash is restored to 100 JOD
  const delRes = deleteCashAdvanceFromState(s2, 'adv-1');
  assert.equal((delRes.nextState.cashAdvances || []).length, 0);
  assert.equal(delRes.nextState.expenses.length, 0);
  assert.ok(delRes.deletedIds.includes('adv-1'));

  const summaryAfterDelete = calculateFinancialSummary(delRes.nextState, 'daily', '2026-10-25');
  assert.equal(summaryAfterDelete.netCashDrawerJod, 100, 'Cash drawer restored to 100 JOD after deleting advance');
});

test('CliQ customer payments are NOT added to cash drawer or morning cash and are aggregated in CliQ account', () => {
  const base = getInitialState('2026-10-25');
  const stateWithVisits: AppState = {
    ...base,
    morningCash: [
      {
        id: 'mc-today',
        date: '2026-10-25',
        amountJod: 50,
        recordedBy: 'admin',
      },
    ],
    visits: [
      // Cash payment: 30 JOD
      {
        id: 'v-cash',
        customerName: 'زبون كاش',
        visitType: 'visit',
        problem: 'صيانة كاش',
        requiredParts: [],
        installedParts: [],
        visitDate: '2026-10-25',
        visitTime: '10:00',
        amountJod: 30,
        isPaid: true,
        paymentMethod: 'cash',
        status: 'resolved',
        isResolved: true,
        source: 'staff',
        createdAt: '2026-10-25T10:00:00Z',
      },
      // CliQ payment: 70 JOD
      {
        id: 'v-cliq',
        customerName: 'زبون كلك',
        phone: '0791234567',
        visitType: 'visit',
        problem: 'صيانة كلك',
        requiredParts: [],
        installedParts: [],
        visitDate: '2026-10-25',
        visitTime: '10:30',
        amountJod: 70,
        isPaid: true,
        paymentMethod: 'cliq',
        status: 'resolved',
        isResolved: true,
        source: 'staff',
        createdAt: '2026-10-25T10:30:00Z',
      },
    ],
  };

  // 1. Check financial summary: Net Cash Drawer should ONLY have Morning Cash (50) + Cash Visit (30) = 80 JOD
  // CliQ payment (70) must NOT be added to Net Cash Drawer!
  const summary = calculateFinancialSummary(stateWithVisits, 'daily', '2026-10-25');
  assert.equal(summary.netCashDrawerJod, 80, 'Net Cash Drawer must only contain cash (50 + 30 = 80)');
  assert.equal(summary.revenueByMethod.cash, 30);
  assert.equal(summary.revenueByMethod.cliq, 70);

  // 2. Check CliQ account metrics: aggregated in CliQ account
  const cliqMetrics = calculateCliqAccountMetrics(stateWithVisits, '2026-10-25');
  assert.equal(cliqMetrics.totalBalanceJod, 70);
  assert.equal(cliqMetrics.todayBalanceJod, 70);
  assert.equal(cliqMetrics.totalTransactionsCount, 1);
  assert.equal(cliqMetrics.visits[0].customerName, 'زبون كلك');

  // 3. Test rollover: transferProfitsToMorningCash must NOT add CliQ to morning cash
  const rollRes = transferProfitsToMorningCash(stateWithVisits, { targetDate: '2026-10-25' }, '2026-10-25');
  // Only 30 JOD cash revenue should be added to morning cash (50 + 30 = 80 JOD), NOT 50 + 100 = 150!
  assert.equal(rollRes.revenueJod, 30, 'Rolled-over revenue must strictly exclude CliQ');
  assert.equal(rollRes.newMorningCashJod, 80, 'New morning cash must not contain CliQ');
});


