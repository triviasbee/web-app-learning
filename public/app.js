// public/app.js
// Kode yang berjalan di browser:
//   1. Mengambil dan mengubah data lewat REST API (fetch)
//   2. Menerima update realtime dari server (Socket.IO)
//   3. Menampilkan data ke halaman

// ---------- Elemen halaman ----------
const form = document.querySelector('#add-form');
const input = document.querySelector('#item-name');
const addButton = form.querySelector('button');
const list = document.querySelector('#item-list');
const template = document.querySelector('#item-template');
const emptyState = document.querySelector('#empty-state');
const remaining = document.querySelector('#remaining');
const clearButton = document.querySelector('#clear-bought');
const filterButtons = document.querySelectorAll('[data-filter]');
const presence = document.querySelector('#presence');
const presenceText = document.querySelector('#presence-text');
const toast = document.querySelector('#toast');

// ---------- State ----------
let items = [];        // salinan data terakhir dari server
let filter = 'all';    // 'all' | 'todo' | 'bought'
let hasLoaded = false; // animasi baru dipakai setelah data pertama tampil

const EMPTY_TEXT = {
  all: 'Daftarnya masih kosong. Tulis barang pertama di atas.',
  todo: 'Tidak ada lagi yang perlu dibeli.',
  bought: 'Belum ada barang yang sudah dibeli.',
};

// Fungsi io() berasal dari /socket.io/socket.io.js yang disediakan server.
// Kalau file HTML dibuka langsung tanpa server, io tidak ada, jadi dicek dulu.
const socket = typeof io === 'function' ? io() : null;

// ---------- Komunikasi dengan server ----------

// Pembungkus fetch: kirim & terima JSON, dan ubah kegagalan jadi pesan yang jelas
async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Server tidak bisa dihubungi. Pastikan "npm start" masih berjalan.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Permintaan gagal (kode ${res.status}).`);
  }
  return res.status === 204 ? null : res.json();
}

async function loadItems() {
  try {
    setItems(await request('GET', '/api/items'));
  } catch (err) {
    showToast(err.message);
  }
}

// Mengubah data di server. Tampilan sengaja TIDAK diubah di sini:
// server akan mengirim 'items:update' ke semua browser, termasuk browser ini.
async function changeItems(method, url, body) {
  try {
    await request(method, url, body);
    if (!socket?.connected) await loadItems(); // cadangan saat realtime terputus
    return true;
  } catch (err) {
    showToast(err.message);
    await loadItems(); // samakan lagi tampilan dengan data di server
    return false;
  }
}

// ---------- Menampilkan data ----------

// Dipanggil setiap ada data baru. Data lama dibandingkan dengan yang baru
// supaya barang yang baru masuk atau baru dicoret bisa diberi animasi.
function setItems(nextItems) {
  const previous = new Map(items.map((item) => [item.id, item]));
  const changes = new Map();

  if (hasLoaded) {
    for (const item of nextItems) {
      const old = previous.get(item.id);
      if (!old) changes.set(item.id, 'is-new');
      else if (old.bought !== item.bought) changes.set(item.id, 'is-toggled');
    }
  }

  items = nextItems;
  hasLoaded = true;
  render(changes);
}

function render(changes = new Map()) {
  // Ingat elemen yang sedang fokus agar pengguna keyboard tidak kehilangan posisi
  const focusedKey = document.activeElement?.dataset?.key;

  const visible = items.filter((item) => {
    if (filter === 'todo') return !item.bought;
    if (filter === 'bought') return item.bought;
    return true;
  });

  list.replaceChildren(...visible.map((item) => renderItem(item, changes.get(item.id))));
  if (focusedKey) list.querySelector(`[data-key="${focusedKey}"]`)?.focus();

  emptyState.hidden = visible.length > 0;
  emptyState.textContent = EMPTY_TEXT[filter];

  const left = items.filter((item) => !item.bought).length;
  if (items.length === 0) remaining.textContent = '';
  else if (left === 0) remaining.textContent = 'Semua sudah dibeli';
  else remaining.textContent = `${left} barang belum dibeli`;

  clearButton.hidden = !items.some((item) => item.bought);
}

function renderItem(item, change) {
  const li = template.content.firstElementChild.cloneNode(true);
  const checkbox = li.querySelector('input');
  const label = li.querySelector('label');
  const name = li.querySelector('.item-name');
  const removeButton = li.querySelector('.remove');

  li.classList.toggle('is-bought', item.bought);
  if (change) li.classList.add(change);

  checkbox.id = `item-${item.id}`;
  checkbox.checked = item.bought;
  checkbox.dataset.key = `check-${item.id}`;
  label.htmlFor = checkbox.id;
  name.textContent = item.name; // textContent (bukan innerHTML) supaya aman dari XSS

  removeButton.dataset.key = `remove-${item.id}`;
  removeButton.setAttribute('aria-label', `Hapus ${item.name}`);

  checkbox.addEventListener('change', () => {
    changeItems('PATCH', `/api/items/${item.id}`, { bought: checkbox.checked });
  });
  removeButton.addEventListener('click', () => {
    changeItems('DELETE', `/api/items/${item.id}`);
  });

  return li;
}

function setFilter(value) {
  filter = value;
  filterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === value));
  });
  render();
}

function setPresence(state, text) {
  presence.dataset.state = state; // 'connecting' | 'online' | 'offline'
  presenceText.textContent = text;
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
}

// ---------- Interaksi pengguna ----------
form.addEventListener('submit', async (event) => {
  event.preventDefault(); // cegah halaman reload saat form dikirim

  const name = input.value.trim();
  if (!name) {
    input.value = '';
    input.focus();
    return;
  }

  // Barang baru belum dibeli, jadi pindah ke "Semua" agar langsung terlihat
  if (filter === 'bought') setFilter('all');

  addButton.disabled = true;
  const ok = await changeItems('POST', '/api/items', { name });
  addButton.disabled = false;

  if (ok) input.value = '';
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

clearButton.addEventListener('click', () => {
  changeItems('DELETE', '/api/items/bought');
});

// ---------- Realtime ----------
const showDisconnected = () => setPresence('offline', 'Koneksi terputus. Mencoba menyambung lagi…');

if (socket) {
  socket.on('connect', () => setPresence('online', 'Terhubung'));
  socket.on('presence', (count) => {
    setPresence('online', count > 1
      ? `${count} orang sedang membuka daftar ini`
      : 'Hanya kamu yang membuka daftar ini');
  });
  socket.on('items:update', setItems); // siapa pun yang mengubah data, semua browser menerima ini
  socket.on('disconnect', showDisconnected);
  socket.on('connect_error', showDisconnected);
  // Setelah tersambung lagi, ambil data terbaru agar tidak ada perubahan yang terlewat
  socket.io.on('reconnect', loadItems);
} else {
  setPresence('offline', 'Realtime tidak aktif. Jalankan "npm start", lalu buka http://localhost:3000');
}

loadItems(); // muat data pertama kali lewat REST API
