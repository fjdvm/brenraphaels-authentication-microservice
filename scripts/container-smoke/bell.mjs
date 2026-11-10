import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const origin = process.env.SMOKE_ORIGIN;
const control = body => fetch('http://127.0.0.1:18080/control', { method: 'POST', body: JSON.stringify(body) });
const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER_CHANNEL || undefined, args: ['--host-resolver-rules=MAP gateway 127.0.0.1', '--no-proxy-server'] });
try {
  const context = await browser.newContext();
  // Store a real session cookie; Chromium permits Secure cookies on loopback HTTP.
  // An extra Cookie header is replaced once middleware populates the cookie jar.
  await context.addCookies([{
    name: '__Secure-neon-auth.session_token', value: 'smoke-session',
    url: origin.replace('http:', 'https:'), secure: true, httpOnly: true, sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  const requests = [];
  page.on('request', req => requests.push(req.url()));
  let connections = 0;
  const frames = [];
  page.on('websocket', socket => {
    connections++;
    socket.on('framereceived', frame => frames.push(String(frame.payload)));
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Notifications', exact: true }).waitFor();
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('/api/notifications')));
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(connections, 1, 'bell must open a WebSocket');
  const idle = requests.length;
  await new Promise(resolve => setTimeout(resolve, 6500));
  assert.equal(requests.length, idle, 'idle tab must make no periodic HTTP requests');
  await control({ notification: 'Live access changed' });
  await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
  await page.getByText('Live access changed', { exact: true }).waitFor();
  await control({ notification: 'Another user only', userId: 'victim' });
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(await page.getByText('Another user only').count(), 0);
  assert.ok(frames.some(frame => frame.includes('Live access changed')), 'own notification reaches the socket');
  assert.ok(frames.every(frame => !frame.includes('Another user only') && !frame.includes('victim')), 'another User notification never reaches the socket');
  const pass = await page.request.post(`${origin}/api/notifications/live?userId=victim`, { data: { userId: 'victim' } });
  assert.equal(pass.status(), 200);
  const { url } = await pass.json();
  assert.ok(!JSON.stringify(pass.headers()).includes('smoke-caller'));
  const refused = await page.evaluate(url => new Promise(resolve => {
    const socket = new WebSocket(url + '&userId=victim');
    socket.onopen = () => { socket.close(); resolve(false); };
    socket.onerror = () => resolve(true);
  }), url);
  assert.ok(refused, 'a session pass cannot open another User inbox');
  await control({ restart: true });
  await control({ notification: 'Missed during restart' });
  await new Promise(resolve => setTimeout(resolve, 1600));
  await control({ resume: true });
  await page.getByRole('button', { name: 'Notifications, 2 unread', exact: true }).waitFor({ timeout: 40_000 });
  await page.getByText('Missed during restart', { exact: true }).waitFor();
  assert.ok(connections >= 2, 'bell reconnects after restart');
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.post(`${origin}/api/notifications/live`, { maxRedirects: 0 });
  assert.ok([401, 302, 307].includes(denied.status()));
  console.log('Bell smoke passed: live delivery, idle silence, user isolation, restart and catch-up.');
} finally { await browser.close(); }
