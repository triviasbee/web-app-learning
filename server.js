// server.js
// Contoh web app interaktif: daftar belanja bersama yang tersinkron realtime.
//
//   Express   -> menyajikan halaman (folder public/) dan REST API (/api/...)
//   Socket.IO -> mengirim perubahan data ke SEMUA browser yang sedang membuka halaman

const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const MAX_NAME_LENGTH = 100;

const app = express();
const server = http.createServer(app); // Express dan Socket.IO memakai server HTTP yang sama
const io = new Server(server);

// ---------------------------------------------------------------------------
// Data
// Disimpan di memori supaya contoh ini tetap sederhana. Artinya, daftar akan
// kembali ke isi awal setiap kali server di-restart.
// ---------------------------------------------------------------------------
function createItem(name, bought = false) {
  return { id: crypto.randomUUID(), name, bought };
}

let items = [
  createItem('Beras 5 kg'),
  createItem('Telur ayam 1 kg', true),
  createItem('Minyak goreng 2 liter'),
  createItem('Cabai rawit 1/4 kg'),
  createItem('Kecap manis'),
];

// Kirim daftar terbaru ke semua browser yang terhubung (termasuk yang mengubahnya)
function broadcastItems() {
  io.emit('items:update', items);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json()); // isi req.body dengan data JSON yang dikirim browser
app.use(express.static(path.join(__dirname, 'public'))); // sajikan index.html, style.css, app.js

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

// Ambil semua barang
app.get('/api/items', (req, res) => {
  res.json(items);
});

// Tambah barang baru. Body: { "name": "Telur 1 kg" }
app.post('/api/items', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!name) {
    return res.status(400).json({ error: 'Tulis nama barangnya dulu.' });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `Nama barang maksimal ${MAX_NAME_LENGTH} karakter.` });
  }

  const item = createItem(name);
  items.push(item);
  broadcastItems();
  res.status(201).json(item);
});

// Tandai barang sudah/belum dibeli. Body: { "bought": true }
app.patch('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Barang tidak ditemukan. Mungkin sudah dihapus dari daftar.' });
  }

  const { bought } = req.body ?? {};
  if (typeof bought !== 'boolean') {
    return res.status(400).json({ error: 'Nilai "bought" harus true atau false.' });
  }

  item.bought = bought;
  broadcastItems();
  res.json(item);
});

// Hapus semua barang yang sudah dibeli.
// Route ini harus ditulis SEBELUM '/api/items/:id', karena Express mencocokkan
// route sesuai urutan. Kalau terbalik, kata "bought" akan dianggap sebagai :id.
app.delete('/api/items/bought', (req, res) => {
  items = items.filter((i) => !i.bought);
  broadcastItems();
  res.status(204).end();
});

// Hapus satu barang
app.delete('/api/items/:id', (req, res) => {
  const index = items.findIndex((i) => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Barang tidak ditemukan. Mungkin sudah dihapus dari daftar.' });
  }

  items.splice(index, 1);
  broadcastItems();
  res.status(204).end();
});

// Alamat API yang tidak ada
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Alamat API tidak ditemukan.' });
});

// Penanganan error, misalnya JSON yang dikirim formatnya rusak.
// Express mengenali middleware error dari 4 parameternya.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status < 500 ? 'Data yang dikirim tidak valid.' : 'Terjadi kesalahan di server.',
  });
});

// ---------------------------------------------------------------------------
// Realtime: hitung berapa orang yang sedang membuka daftar
// ---------------------------------------------------------------------------
let onlineCount = 0;

io.on('connection', (socket) => {
  onlineCount++;
  io.emit('presence', onlineCount);

  socket.on('disconnect', () => {
    onlineCount--;
    io.emit('presence', onlineCount);
  });
});

server.listen(PORT, () => {
  console.log(`Daftar belanja berjalan di http://localhost:${PORT}`);
});
