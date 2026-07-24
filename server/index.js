const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

// HTTP server для раздачи статики
const httpServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    }
  });
});

// WebSocket на том же HTTP сервере
const wss = new WebSocket.Server({ server: httpServer });

let worldState = [];
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('Client connected. Total:', clients.length);

  ws.send(JSON.stringify({ type: 'sync', data: worldState }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }

    switch (msg.type) {
      case 'place': {
        if (msg.cell) {
          worldState = worldState.filter(c => c.x !== msg.cell.x || c.y !== msg.cell.y);
          if (msg.cell.type) {
            worldState.push(msg.cell);
          }
        }
        clients.forEach(c => {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: 'place', cell: msg.cell }));
          }
        });
        break;
      }

      case 'cursor': {
        clients.forEach(c => {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: 'cursor', x: msg.x, y: msg.y, seed: msg.seed || 0, name: msg.name || 'Friend' }));
          }
        });
        break;
      }

      case 'ping': {
        if (msg.t) {
          ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
        } else {
          clients.forEach(c => {
            if (c !== ws && c.readyState === WebSocket.OPEN) {
              c.send(JSON.stringify({ type: 'ping', x: msg.x, y: msg.y, emoji: msg.emoji || '⚠️' }));
            }
          });
        }
        break;
      }

      case 'clear': {
        worldState = [];
        clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: 'clear' }));
          }
        });
        break;
      }

      case 'chat': {
        clients.forEach(c => {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: 'chat', text: msg.text }));
          }
        });
        break;
      }

      case 'gravity':
      case 'wind': {
        clients.forEach(c => {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify(msg));
          }
        });
        break;
      }

      case 'pvp': {
        clients.forEach(c => {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: 'pvp', pvp: msg.pvp }));
          }
        });
        break;
      }

      case 'player_spawn':
      case 'player_despawn':
      case 'player_move': {
        clients.forEach(c => {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify(msg));
          }
        });
        break;
      }

      case 'sync_request': {
        ws.send(JSON.stringify({ type: 'sync', data: worldState }));
        break;
      }
    }
  });

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    console.log('Client disconnected. Total:', clients.length);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('Sandbox server on port ' + PORT);
});
