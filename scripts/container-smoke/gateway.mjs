// External gateway/notifications fixture. No Portal internals are replaced.
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
let rows = [];
let stopped = false;
const tickets = new Map();
const sockets = new Set();
function frame(data) {
  const body = Buffer.from(JSON.stringify(data));
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
  return Buffer.concat([header, body]);
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://gateway');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  res.setHeader('Content-Type', 'application/json');
  const reply = (value, status = 200) => { res.writeHead(status); res.end(JSON.stringify(value)); };
  if (url.pathname === '/control') {
    if (body.restart) { stopped = true; for (const socket of sockets) socket.destroy(); }
    if (body.resume) stopped = false;
    if (body.notification) {
      const notification = { id: randomUUID(), title: body.notification, userId: body.userId ?? 'smoke-user', sendingApp: 'Portal', targetApp: 'Portal', createdAt: new Date().toISOString(), readAt: null, link: null };
      rows.unshift(notification);
      if (!stopped) for (const socket of sockets) if (socket.userId === notification.userId) socket.write(frame({ type: 'notification.created', notification }));
    }
    return reply({ ok: true });
  }
  if (req.headers.authorization !== 'Bearer smoke-caller') return reply({}, 401);
  if (stopped) return reply({}, 503);
  if (url.pathname === '/live-tickets') {
    const ticket = randomUUID();
    tickets.set(ticket, { userId: body.userId, expires: Date.now() + 60_000 });
    return reply({ ticket, expiresIn: 60 });
  }
  const own = rows.filter(row => row.userId === url.searchParams.get('userId'));
  if (url.pathname.endsWith('/unread-count')) return reply({ unread: own.filter(row => !row.readAt).length });
  if (url.pathname === '/notifications/notifications') return reply({ notifications: own.slice(0, 20) });
  reply({}, 404);
});
server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://gateway');
  const claims = tickets.get(url.searchParams.get('ticket'));
  if (stopped || url.pathname !== '/notifications/live' || !claims || claims.expires < Date.now() || (url.searchParams.has('userId') && url.searchParams.get('userId') !== claims.userId)) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return;
  }
  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.userId = claims.userId;
  sockets.add(socket);
  socket.on('error', () => socket.destroy());
  socket.on('close', () => sockets.delete(socket));
  socket.on('data', data => { if ((data[0] & 15) === 8) socket.end(Buffer.from([0x88, 0])); });
});
server.listen(18080, '0.0.0.0');
