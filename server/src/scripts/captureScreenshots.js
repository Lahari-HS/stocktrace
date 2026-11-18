import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_SCREENSHOTS = 'C:\\Users\\LAHARI HS\\.gemini\\antigravity\\brain\\f50a1a31-16f6-45b6-88a1-7ea58badc688\\screenshots';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\Temp', 'chrome_stocktrace_cdp_' + Date.now());
const PORT = 9233;

if (!fs.existsSync(ARTIFACT_SCREENSHOTS)) {
  fs.mkdirSync(ARTIFACT_SCREENSHOTS, { recursive: true });
}

async function capture() {
  console.log(`[CDP] Launching Chrome headless on port ${PORT}...`);
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1366,850',
    'about:blank',
  ], {
    detached: true,
    stdio: 'ignore',
  });

  // Wait 3 seconds for Chrome to start
  await new Promise((r) => setTimeout(r, 3000));

  console.log(`[CDP] Creating new target at http://127.0.0.1:${PORT}/json/new?http://localhost:5000...`);
  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:5000`, { method: 'PUT' });
  const pageTarget = await newTabRes.json();
  console.log('[CDP] Created page target:', pageTarget.id, pageTarget.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let messageId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP command ${method} timed out after 12s`));
        }
      }, 12000);

      pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const takeScreenshot = async (urlPath, filename, delayMs = 2500) => {
    const fullUrl = `http://localhost:5000${urlPath}`;
    console.log(`[CDP] Navigating to ${fullUrl}...`);
    await send('Page.navigate', { url: fullUrl });
    await new Promise((r) => setTimeout(r, delayMs));

    console.log(`[CDP] Capturing screenshot: ${filename}...`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    const dest = path.join(ARTIFACT_SCREENSHOTS, filename);
    fs.writeFileSync(dest, buffer);
    console.log(`[CDP] Saved ${filename} (${buffer.length} bytes)`);
  };

  // 1. Product Table Screen
  await takeScreenshot('/', '01_product_table.png', 3000);

  // 2. Open Detail Drawer on Product Table
  console.log('[CDP] Clicking first product to open detail drawer...');
  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('tbody tr');
      if (row) row.click();
    `,
  });
  await new Promise((r) => setTimeout(r, 1500));
  const drawerScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_SCREENSHOTS, '02_product_detail_drawer.png'), Buffer.from(drawerScreenshot.data, 'base64'));
  console.log('[CDP] Saved 02_product_detail_drawer.png');

  // 3. Billing (POS) Screen
  await takeScreenshot('/pos', '03_pos_billing.png', 2500);

  // 4. Movements Ledger Screen
  await takeScreenshot('/movements', '04_movements_ledger.png', 2500);

  // 5. Reconcile Screen
  await takeScreenshot('/reconcile', '05_reconciliation_audit.png', 2500);

  // 6. Dashboard Screen
  await takeScreenshot('/dashboard', '06_dashboard.png', 2500);

  // 7. Reports Screen
  await takeScreenshot('/reports', '07_reports_financial.png', 2500);

  // 8. Mobile View of POS Billing
  console.log('[CDP] Capturing mobile-responsive layout...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await takeScreenshot('/pos', '08_mobile_counter_pos.png', 2000);

  ws.close();
  try {
    chromeProcess.kill();
  } catch (e) {}

  console.log('🎉 All key screenshots captured successfully as artifacts!');
  process.exit(0);
}

capture().catch((err) => {
  console.error('[CDP Error]', err);
  process.exit(1);
});
