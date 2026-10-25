import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'al_madar_live_state.json');
const LIVE_STATE_DOC_ID = 'live_state_v3';

interface StoredSyncPayload {
  state: Record<string, unknown> | null;
  updatedAt: number;
  clientId: string;
  deletedIds?: string[];
  forceReplace?: boolean;
  resetEpoch?: number;
}

let firestoreDb: Firestore | null = null;
try {
  const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    try {
      firestoreDb = initializeFirestore(
        fbApp,
        { experimentalForceLongPolling: true },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    }
    console.log('Connected to Firestore database:', firebaseConfig.firestoreDatabaseId);
  }
} catch (err) {
  console.warn('Could not initialize Firebase in server:', err);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStoredPayload(): StoredSyncPayload {
  try {
    ensureDataDir();
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as StoredSyncPayload;
      if (parsed && typeof parsed === 'object' && parsed.state) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read live state file:', err);
  }
  return { state: null, updatedAt: 0, clientId: 'init' };
}

function writeStoredPayload(payload: StoredSyncPayload) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write live state file:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  let currentPayload: StoredSyncPayload = readStoredPayload();
  const sseClients = new Set<express.Response>();

  // Hydrate state from Firestore if available
  if (firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, 'system', LIVE_STATE_DOC_ID));
      if (snap.exists()) {
        const data = snap.data() as StoredSyncPayload;
        if (
          data &&
          data.state &&
          typeof data.state === 'object' &&
          typeof data.updatedAt === 'number'
        ) {
          if (data.updatedAt >= currentPayload.updatedAt) {
            currentPayload = data;
            writeStoredPayload(currentPayload);
            console.log('Server state hydrated from Firestore. Timestamp:', data.updatedAt);
          }
        }
      }
    } catch (err) {
      console.warn('Could not read initial state from Firestore:', err);
    }

    // Subscribe to Firestore changes to synchronize all Cloud Run instances
    try {
      onSnapshot(
        doc(firestoreDb, 'system', LIVE_STATE_DOC_ID),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as StoredSyncPayload;
            if (
              data &&
              data.state &&
              typeof data.state === 'object' &&
              typeof data.updatedAt === 'number'
            ) {
              if (
                data.updatedAt > currentPayload.updatedAt ||
                (typeof data.resetEpoch === 'number' &&
                  data.resetEpoch > (currentPayload.resetEpoch || 0))
              ) {
                currentPayload = data;
                writeStoredPayload(currentPayload);
                broadcastToClients(currentPayload);
              }
            }
          }
        },
        (err) => {
          console.warn('Server Firestore listener warning:', err?.message || err);
        }
      );
    } catch (err) {
      console.warn('Could not subscribe to Firestore snapshot:', err);
    }
  }

  const broadcastToClients = (payload: StoredSyncPayload) => {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // Real-time Server-Sent Events stream for instant device-to-device sync
  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial state immediately on connect
    res.write(`data: ${JSON.stringify(currentPayload)}\n\n`);
    sseClients.add(res);

    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAliveTimer);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      sseClients.delete(res);
    });
  });

  // Get current shared state across devices
  app.get('/api/state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(currentPayload);
  });

  function mergeCollection<T extends { id?: string; username?: string }>(
    existing: T[] = [],
    incoming: T[] = [],
    deletedSet: Set<string>
  ): T[] {
    const map = new Map<string, T>();
    if (Array.isArray(existing)) {
      for (const item of existing) {
        const key = item?.username
          ? `usr_${item.username.trim().toLowerCase()}`
          : item?.id;
        if (
          key &&
          !deletedSet.has(key) &&
          (!item?.id || !deletedSet.has(item.id)) &&
          (!item?.username || !deletedSet.has(item.username))
        ) {
          map.set(key, item);
        }
      }
    }
    if (Array.isArray(incoming)) {
      for (const item of incoming) {
        const key = item?.username
          ? `usr_${item.username.trim().toLowerCase()}`
          : item?.id;
        if (
          key &&
          !deletedSet.has(key) &&
          (!item?.id || !deletedSet.has(item.id)) &&
          (!item?.username || !deletedSet.has(item.username))
        ) {
          const prev = map.get(key) as any;
          if (!prev || !(prev.id === 'user-admin' && item?.id === 'u-admin')) {
            const prevUpdated =
              prev && typeof prev.updatedAt === 'number' ? prev.updatedAt : 0;
            const itemUpdated =
              item && typeof (item as any).updatedAt === 'number'
                ? (item as any).updatedAt
                : 0;
            if (prev && prevUpdated > itemUpdated) {
              continue;
            }
            if (prev && typeof prev === 'object' && 'isRead' in prev && item && typeof item === 'object' && 'isRead' in item) {
              map.set(key, {
                ...item,
                isRead: Boolean(prev.isRead || (item as any).isRead),
              });
            } else {
              map.set(key, item);
            }
          }
        }
      }
    }
    return Array.from(map.values());
  }

  function mergePayloadStates(
    existingState: Record<string, any> | null,
    incomingState: Record<string, any>,
    deletedIds: string[] = []
  ): Record<string, any> {
    if (!existingState) return incomingState;
    if (!incomingState) return existingState;

    const deletedSet = new Set(deletedIds || []);

    const mergedVisits = mergeCollection(existingState.visits, incomingState.visits, deletedSet);
    const mergedAppointments = mergeCollection(
      existingState.appointments,
      incomingState.appointments,
      deletedSet
    ).filter((a: any) => !a?.linkedVisitId || !deletedSet.has(a.linkedVisitId));
    const mergedNotifications = mergeCollection(
      existingState.notifications,
      incomingState.notifications,
      deletedSet
    ).filter((n: any) => !n?.linkedVisitId || !deletedSet.has(n.linkedVisitId));
    const mergedExpenses = mergeCollection(
      existingState.expenses,
      incomingState.expenses,
      deletedSet
    ).filter((e: any) => !e?.linkedPurchaseId || !deletedSet.has(e.linkedPurchaseId));

    const rawPurchases = mergeCollection(existingState.purchases, incomingState.purchases, deletedSet);
    const normalizedPurchases = rawPurchases.map((p: any) => {
      if (!p || typeof p !== 'object') return p;
      const createdDate = typeof p.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.createdAt)
        ? p.createdAt.slice(0, 10)
        : '';
      const invDate = typeof p.invoiceDate === 'string' ? p.invoiceDate.trim().slice(0, 10) : '';
      if (createdDate && (!invDate || invDate.slice(0, 4) < createdDate.slice(0, 4))) {
        return { ...p, invoiceDate: createdDate };
      }
      return p;
    });

    return {
      ...existingState,
      ...incomingState,
      users: mergeCollection(existingState.users, incomingState.users, deletedSet),
      customers: mergeCollection(existingState.customers, incomingState.customers, deletedSet),
      parts: mergeCollection(existingState.parts, incomingState.parts, deletedSet),
      purchases: normalizedPurchases,
      visits: mergedVisits,
      expenses: mergedExpenses,
      morningCash: mergeCollection(existingState.morningCash, incomingState.morningCash, deletedSet),
      appointments: mergedAppointments,
      dailyNotes: mergeCollection(existingState.dailyNotes, incomingState.dailyNotes, deletedSet),
      expenseTemplates: mergeCollection(existingState.expenseTemplates, incomingState.expenseTemplates, deletedSet),
      notifications: mergedNotifications,
    };
  }

  // Update shared state from any device and broadcast to all other devices
  app.post('/api/state', async (req, res) => {
    const body = req.body as {
      state?: Record<string, any> | null;
      clientId?: string;
      updatedAt?: number;
      deletedIds?: string[];
      forceReplace?: boolean;
      resetEpoch?: number;
    };

    if (!body || typeof body.state !== 'object' || !body.state) {
      res.status(400).json({ error: 'Invalid state payload' });
      return;
    }

    const incomingUpdatedAt = body.updatedAt || Date.now();
    const incomingDeletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];
    const isForceReplace =
      Boolean(body.forceReplace) ||
      (typeof body.resetEpoch === 'number' &&
        body.resetEpoch > (currentPayload.resetEpoch || 0));

    const combinedDeletedIds = isForceReplace
      ? []
      : Array.from(
          new Set([...(currentPayload.deletedIds || []), ...incomingDeletedIds])
        ).slice(-600);

    // When forceReplace is true (e.g. System Reset or Full Backup Replace), replace state directly without merging old records
    const mergedState = isForceReplace
      ? body.state
      : mergePayloadStates(currentPayload.state, body.state, combinedDeletedIds);

    currentPayload = {
      state: mergedState,
      updatedAt: Math.max(incomingUpdatedAt, currentPayload.updatedAt || 0, Date.now()),
      clientId: body.clientId || 'unknown',
      deletedIds: combinedDeletedIds,
      forceReplace: isForceReplace,
      resetEpoch:
        typeof body.resetEpoch === 'number'
          ? Math.max(body.resetEpoch, currentPayload.resetEpoch || 0)
          : currentPayload.resetEpoch,
    };

    writeStoredPayload(currentPayload);
    broadcastToClients(currentPayload);

    // Save to Firestore asynchronously (strip undefined fields so Firestore never rejects)
    if (firestoreDb) {
      const cleanFirestoreDoc = JSON.parse(
        JSON.stringify({
          ...currentPayload,
          deletedIds: combinedDeletedIds,
        })
      );
      setDoc(doc(firestoreDb, 'system', LIVE_STATE_DOC_ID), cleanFirestoreDoc).catch((err) => {
        console.warn('Failed to persist state to Firestore:', err);
      });
    }

    res.json({
      ok: true,
      updatedAt: currentPayload.updatedAt,
      clientId: currentPayload.clientId,
      state: currentPayload.state,
      deletedIds: currentPayload.deletedIds,
      forceReplace: currentPayload.forceReplace,
      resetEpoch: currentPayload.resetEpoch,
    });
  });

  // OCR and Work Notes scanning endpoint using Gemini Vision
  app.post('/api/scan-work-notes', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64) {
        res.status(400).json({ error: 'لم يتم إرسال صورة ورقة العمل (Missing imageBase64)' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error: 'مفتاح Gemini API غير مهيأ على الخادم (GEMINI_API_KEY missing)',
        });
        return;
      }

      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const cleanWorkText = (str?: string): string => {
        if (!str || typeof str !== 'string') return '';
        return str
          .replace(/[|~^`_\\«»[\]{}]/g, ' ')
          .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, '$1 $2')
          .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, '$1 $2')
          .replace(/(\d)(gb|tb|mb|w|v|a|mhz|ghz|mp)\b/gi, (_, num, unit) => `${num}${unit.toUpperCase()}`)
          .replace(/\s+/g, ' ')
          .trim();
      };

      const prompt = `أنت خبير فني وتقني في شركة «المدار لتجارة تكنولوجيا المعلومات».
مهمتك: قراءة وتفريغ ورقة ملاحظات العمل اليومي أو أمر زيارة الصيانة المرفقة في الصورة (سواء كانت مكتوبة بخط اليد أو مطبوعة) بدون أي تداخل في الكلام.

قواعد تحسين الكتابة ومنع التداخل:
1. افصل بمسافة واضحة بين الكلمات العربية والمصطلحات الإنجليزية والأرقام (مثال: "تركيب قرص تخزين SSD 240GB وتمديد كابل شبكة Cat6").
2. اقرأ كافة الملاحظات الفنية المكتوبة على الورقة دون تحريف، وفرّغها في (transcribedText) بصياغة عربية واضحة ومرتبة.
3. استخرج البيانات المنظمة التالية إن كانت متوفرة في الورقة:
   - customerName: اسم الزبون أو الشركة أو المحل (نظيفاً بدون كلمة الزبون:)
   - phone: رقم الهاتف (أرقام فقط مثل 079xxxxxxx)
   - problem: وصف واضح ومرتب للمشكلة أو العطل أو العمل المطلوب
   - technicianName: اسم الفني
   - requiredParts: مصفوفة أسماء القطع المطلوبة بصياغة مرتبة (مثل: ["كابل شبكة Cat6", "محول طاقة 12V 2A"])
   - installedParts: مصفوفة القطع التي تم تركيبها فعلياً بصياغة مرتبة (مثل: ["كاميرا مراقبة Hikvision 2MP", "قرص SSD 240GB"])
   - amountJod: المبلغ أو التكلفة بالدينار الأردني كرقم فقط (أو null إن لم يذكر)
   - notesSummary: ملخص واضح ومختصر للملاحظات الفنية للعمل اليومي

أخرج النتيجة بصيغة JSON فقط:
{
  "transcribedText": "نص الملاحظات الفنية المكتوبة على الورقة كاملة...",
  "notesSummary": "ملخص الملاحظات الفنية...",
  "customerName": "",
  "phone": "",
  "problem": "",
  "technicianName": "",
  "requiredParts": [],
  "installedParts": [],
  "amountJod": null
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '{}';
      let parsedData: any;
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = {
          transcribedText: rawText,
          notesSummary: rawText,
          customerName: '',
          phone: '',
          problem: '',
          technicianName: '',
          requiredParts: [],
          installedParts: [],
          amountJod: null,
        };
      }

      const sanitizedData = {
        transcribedText: cleanWorkText(parsedData.transcribedText || parsedData.notesSummary || ''),
        notesSummary: cleanWorkText(parsedData.notesSummary || ''),
        customerName: cleanWorkText(parsedData.customerName || ''),
        phone: typeof parsedData.phone === 'string' ? parsedData.phone.replace(/[^\d+]/g, '') : '',
        problem: cleanWorkText(parsedData.problem || ''),
        technicianName: cleanWorkText(parsedData.technicianName || ''),
        requiredParts: Array.isArray(parsedData.requiredParts)
          ? parsedData.requiredParts.map((p: any) => cleanWorkText(String(p))).filter(Boolean)
          : [],
        installedParts: Array.isArray(parsedData.installedParts)
          ? parsedData.installedParts.map((p: any) => cleanWorkText(String(p))).filter(Boolean)
          : [],
        amountJod:
          parsedData.amountJod !== null &&
          parsedData.amountJod !== undefined &&
          !Number.isNaN(Number(parsedData.amountJod))
            ? Number(parsedData.amountJod)
            : null,
      };

      res.json({
        success: true,
        data: sanitizedData,
      });
    } catch (err: any) {
      console.error('Work notes OCR error:', err);
      res.status(500).json({
        error: err?.message || 'تعذر معالجة وقراءة ورقة الملاحظات',
      });
    }
  });

  // OCR and Invoice scanning endpoint using Gemini Vision for Spare Parts purchases
  app.post('/api/scan-invoice', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64) {
        res.status(400).json({ error: 'لم يتم إرسال صورة الفاتورة (Missing imageBase64)' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error: 'مفتاح Gemini API غير مهيأ على الخادم (GEMINI_API_KEY missing)',
        });
        return;
      }

      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const cleanOcrText = (str?: string): string => {
        if (!str || typeof str !== 'string') return '';
        return str
          // Remove OCR table border/artifact characters
          .replace(/[|~^`_\\«»[\]{}]/g, ' ')
          // Separate Arabic and Latin/numbers if glued by OCR
          .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, '$1 $2')
          .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, '$1 $2')
          // Standardize spaces around dashes and slashes
          .replace(/\s*-\s*/g, ' - ')
          .replace(/\s*\/\s*/g, ' / ')
          // Normalize IT capacity units
          .replace(/(\d+)\s+(gb|tb|mb|w|v)\b/gi, '$1$2')
          .replace(/\bssd\b/gi, 'SSD')
          .replace(/\bhdd\b/gi, 'HDD')
          .replace(/\bram\b/gi, 'RAM')
          .replace(/\b(\d+)gb\b/gi, '$1GB')
          .replace(/\b(\d+)tb\b/gi, '$1TB')
          // Normalize spacing
          .replace(/\s+/g, ' ')
          // Remove ugly leading/trailing punctuation artifacts
          .replace(/^[\s,.\-–—:;|#]+|[\s,.\-–—:;|#]+$/g, '')
          .trim();
      };

      const prompt = `أنت خبير حسابات وتدقيق فواتير مشتريات وقطع غيار في شركة «المدار لتجارة تكنولوجيا المعلومات».
مهمتك: قراءة وتفريغ فاتورة مشتريات القطع أو سند الشراء أو الوصل المرفق في الصورة بأعلى درجات الدقة والوضوح اللغوي، وصياغة الكلمات بطريقة نقية وسليمة ومنظمة تماماً.

تعليمات صارمة لمنع تداخل الكلمات والتشويش وتحسين صياغة الكلام (بالغة الأهمية):
1. صياغة أسماء القطع والمواد (partName):
   - اكتب اسم كل قطعة بصياغة عربية وتقنية واضحة ومرتبة ومفهومة (مثال: "قرص تخزين صلب Kingston SSD 240GB"، "سويتش شبكة D-Link 8-Port"، "كيبل شبكة Cat6 خارجي"، "مزود طاقة Power Supply 500W").
   - اترك مسافة واضحة بين الكلمات العربية والكلمات الإنجليزية والأرقام لمنع التصاق الحروف أو تداخلها نهائياً.
   - اعزل اسم القطعة تماماً عن السعر والكمية والباركود ورقم السطر وعناوين الجدول (لا تضع كلمات مثل "الصنف" أو "البيان" أو "السعر" أو "الرقم الضريبي" داخل اسم القطعة).
   - إذا كان النص في الصورة مكتوباً بخط يدوي أو مختصراً أو مشوشاً، أعد كتابته بصياغة سليمة ومفهومة دون حروف مكسورة أو متداخلة.
2. اسم المورد (supplierName):
   - استخرج اسم الشركة أو المحل فقط بصياغة نظيفة دون دمج أرقام الهواتف أو الرقم الضريبي أو العنوان معه.
3. رقم الفاتورة (invoiceNumber):
   - استخرج الرقم أو الكود فقط (مثال: "1045" أو "INV-204") بدون كلمة "فاتورة رقم".
4. الحسابات والأرقام:
   - تأكد من دقة الكمية (quantity) وسعر الوحدة (unitCostJod) والإجمالي (totalCostJod) بالدينار الأردني.
5. الملاحظات (notes):
   - اكتب أي ملاحظات مهمة (مثل مدة الكفالة أو شروط الدفع) بجملة عربية سليمة ومختصرة دون حشو.

المطلوب استخراجه كـ JSON فقط:
{
  "supplierName": "اسم المورد أو المحل بوضوح",
  "invoiceNumber": "رقم الفاتورة إن وجد",
  "invoiceDate": "YYYY-MM-DD",
  "paymentMethod": "cash | cliq | credit",
  "notes": "ملاحظات الفاتورة منسقة وسليمة",
  "totalCostJod": 0,
  "items": [
    {
      "partName": "اسم القطعة نقي ومنسق بدون تداخل",
      "category": "تخزين وهاردوير | شبكات وكابلات | كاميرات ومراقبة | قطع غيار وطابعات | محولات وكهرباء | إكسسوارات وملحقات | أخرى",
      "quantity": 1,
      "unit": "قطعة | متر | حبة | علبة | كرتونة | لفة",
      "unitCostJod": 10,
      "totalCostJod": 10,
      "suggestedSellingPriceJod": 14
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '{}';
      let parsedData: any;
      try {
        const cleanedJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        parsedData = JSON.parse(cleanedJson);
      } catch {
        parsedData = {
          supplierName: '',
          invoiceNumber: '',
          invoiceDate: '',
          paymentMethod: 'cash',
          notes: cleanOcrText(rawText),
          totalCostJod: 0,
          items: [],
        };
      }

      // Clean up strings and validate numbers to guarantee no scrambled or glued text
      if (parsedData) {
        const currentToday = new Date().toISOString().slice(0, 10);
        parsedData.invoiceDate = currentToday;
        if (parsedData.supplierName) parsedData.supplierName = cleanOcrText(parsedData.supplierName);
        if (parsedData.invoiceNumber) {
          parsedData.invoiceNumber = cleanOcrText(parsedData.invoiceNumber)
            .replace(/^(فاتورة|رقم الفاتورة|سند رقم|فاتورة رقم|invoice|inv|no|#|:|\s)+/i, '')
            .trim();
        }
        if (parsedData.notes) parsedData.notes = cleanOcrText(parsedData.notes);
        if (Array.isArray(parsedData.items)) {
          parsedData.items = parsedData.items.map((it: any, idx: number) => {
            const qty = Math.max(0.1, Number(it.quantity) || 1);
            let unitCost = Math.max(0, Number(it.unitCostJod) || 0);
            let totalCost = Math.max(0, Number(it.totalCostJod) || 0);
            if (unitCost === 0 && totalCost > 0) {
              unitCost = Math.round((totalCost / qty) * 100) / 100;
            } else if (totalCost === 0 && unitCost > 0) {
              totalCost = Math.round(qty * unitCost * 100) / 100;
            }
            return {
              ...it,
              partName: cleanOcrText(it.partName) || `قطعة رقم ${idx + 1}`,
              category: cleanOcrText(it.category) || 'تخزين وهاردوير',
              unit: cleanOcrText(it.unit) || 'قطعة',
              quantity: qty,
              unitCostJod: unitCost,
              totalCostJod: totalCost,
            };
          });
        }
      }

      res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Invoice OCR error:', err);
      res.status(500).json({
        error: err?.message || 'تعذر معالجة وقراءة فاتورة المشتريات',
      });
    }
  });

  // In-memory + disk store for generated PDF reports so they can be shared directly via WhatsApp links
  const pdfReportsCache = new Map<
    string,
    { buffer: Buffer; fileName: string; createdAt: number }
  >();
  const REPORTS_DIR = path.join(DATA_DIR, 'reports');

  app.post('/api/reports/pdf', async (req, res) => {
    try {
      const { pdfBase64, fileName = 'AlMadar_Report.pdf' } = req.body as {
        pdfBase64?: string;
        fileName?: string;
      };
      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        res.status(400).json({ error: 'Missing pdfBase64' });
        return;
      }

      const rawBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(rawBase64, 'base64');
      const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const reportId = `rep_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      pdfReportsCache.set(reportId, {
        buffer,
        fileName: cleanName,
        createdAt: Date.now(),
      });

      // Keep cache bounded to 30 recent reports
      if (pdfReportsCache.size > 30) {
        const oldestKey = pdfReportsCache.keys().next().value;
        if (oldestKey) pdfReportsCache.delete(oldestKey);
      }

      try {
        if (!fs.existsSync(REPORTS_DIR)) {
          fs.mkdirSync(REPORTS_DIR, { recursive: true });
        }
        fs.writeFileSync(path.join(REPORTS_DIR, `${reportId}.pdf`), buffer);
      } catch {
        // Ignore disk write error if read-only
      }

      // Persist in Firestore if within document size limit (< 750KB) so multi-instance links never 404
      if (firestoreDb && rawBase64.length < 950_000) {
        setDoc(doc(firestoreDb, 'pdf_reports', reportId), {
          pdfBase64: rawBase64,
          fileName: cleanName,
          createdAt: Date.now(),
        }).catch(() => {});
      }

      const downloadPath = `/api/reports/pdf/${reportId}/${encodeURIComponent(
        cleanName
      )}`;
      res.json({
        ok: true,
        id: reportId,
        path: downloadPath,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to store PDF' });
    }
  });

  app.get('/api/reports/pdf/:id/:fileName?', async (req, res) => {
    const { id, fileName } = req.params;
    const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const cached = pdfReportsCache.get(safeId);
    const rawName = fileName || cached?.fileName || 'AlMadar_Report.pdf';
    const safeAsciiName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = safeAsciiName.endsWith('.pdf')
      ? safeAsciiName
      : `${safeAsciiName}.pdf`;

    const sendPdfBuffer = (buf: Buffer) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${finalName}"; filename*=UTF-8''${encodeURIComponent(
          finalName
        )}`
      );
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    };

    if (cached) {
      sendPdfBuffer(cached.buffer);
      return;
    }

    const diskPath = path.join(REPORTS_DIR, `${safeId}.pdf`);
    if (fs.existsSync(diskPath)) {
      try {
        const diskBuf = fs.readFileSync(diskPath);
        sendPdfBuffer(diskBuf);
        return;
      } catch {
        // continue to Firestore fallback
      }
    }

    if (firestoreDb) {
      try {
        const snap = await getDoc(doc(firestoreDb, 'pdf_reports', safeId));
        if (snap.exists()) {
          const data = snap.data() as { pdfBase64?: string; fileName?: string };
          if (data?.pdfBase64) {
            const buf = Buffer.from(data.pdfBase64, 'base64');
            pdfReportsCache.set(safeId, {
              buffer: buf,
              fileName: data.fileName || finalName,
              createdAt: Date.now(),
            });
            sendPdfBuffer(buf);
            return;
          }
        }
      } catch {
        // Ignore Firestore read error
      }
    }

    res.status(404).send('PDF Report not found or expired.');
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Al-Madar Live Sync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
