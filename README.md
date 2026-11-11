# Daftar Belanja Bersama

Contoh web app interaktif dengan **Node.js**, **Express**, dan **Socket.IO**.

Satu daftar belanja yang bisa dibuka banyak orang sekaligus. Setiap barang yang ditambah, dicoret, atau dihapus langsung muncul di semua browser yang sedang membukanya, tanpa refresh.

## Cara menjalankan

Butuh Node.js versi 18 atau lebih baru.

```bash
npm install
npm start
```

Lalu buka <http://localhost:3000>. Supaya efek realtime-nya terlihat, buka di dua tab berdampingan, atau buka juga dari HP yang tersambung ke Wi-Fi yang sama lewat `http://<IP-komputer>:3000`.

Saat mengembangkan, pakai `npm run dev` agar server otomatis restart setiap kali `server.js` disimpan.

## Struktur proyek

```
server.js          Server: Express (REST API + file statis) dan Socket.IO (realtime)
public/
  index.html       Struktur halaman
  style.css        Tampilan (termasuk mode gelap)
  app.js           Logika di browser: fetch ke API, terima update realtime, tampilkan data
```

## Alur datanya

1. Browser mengubah data lewat REST API dengan `fetch` (POST, PATCH, DELETE).
2. Server mengubah data, lalu memanggil `io.emit('items:update', items)`.
3. Semua browser yang terhubung, termasuk pengirimnya, menerima daftar terbaru dan menampilkannya ulang.

Jadi sumber data hanya satu, yaitu server. Browser tidak pernah mengubah tampilan sendiri sebelum server setuju.

## REST API

| Method | Endpoint             | Fungsi                         | Body                         |
| ------ | -------------------- | ------------------------------ | ---------------------------- |
| GET    | `/api/items`         | Ambil semua barang             |                              |
| POST   | `/api/items`         | Tambah barang                  | `{ "name": "Telur 1 kg" }`   |
| PATCH  | `/api/items/:id`     | Tandai sudah/belum dibeli      | `{ "bought": true }`         |
| DELETE | `/api/items/:id`     | Hapus satu barang              |                              |
| DELETE | `/api/items/bought`  | Hapus semua yang sudah dibeli  |                              |

Coba tambah barang dari terminal sambil browser tetap terbuka, barangnya akan langsung muncul:

```bash
curl -X POST http://localhost:3000/api/items -H "Content-Type: application/json" -d '{"name":"Gula pasir 1 kg"}'
```

Di PowerShell (Windows):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/items -ContentType "application/json" -Body '{"name":"Gula pasir 1 kg"}'
```

## Catatan

Data disimpan di memori, jadi daftar kembali ke isi awal setiap kali server di-restart.

## Ide pengembangan

- Simpan data ke database (SQLite, PostgreSQL, atau MongoDB) supaya tidak hilang.
- Tambahkan nama pengguna agar terlihat siapa yang menambah barang.
- Buat beberapa daftar terpisah memakai fitur *room* di Socket.IO.
- Tambahkan fitur ubah nama barang (double-click untuk edit) dengan endpoint PATCH yang sama.
