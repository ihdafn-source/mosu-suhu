# MOSU Suhu Dashboard

Dashboard monitoring suhu berbasis React + Vite yang terhubung ke Supabase online.

## 1) Integrasi Supabase Online

Project ini sudah disiapkan memakai `@supabase/supabase-js`.

### Langkah cepat

1. Buka Supabase Dashboard dan buat project baru.
2. Ambil `Project URL` dan `anon public key` dari menu `Settings > API`.
3. Buat file `.env.local` di root project.
4. Isi env berikut:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. Jalankan app:

```bash
npm install
npm run dev
```

## 2) Buat Database via UI Supabase (Tanpa SQL)

Gunakan menu `Table Editor` di Supabase, lalu klik `Create a new table` untuk tiap tabel berikut.

### Tabel: `admin_config`

- `id`: int8, primary key
- `pin_code`: text, not null

Data awal (manual insert 1 row):
- `id = 1`
- `pin_code = 1234`

### Tabel: `telegram_alert_config`

- `id`: int8, primary key
- `chat_id`: text
- `bot_token`: text
- `threshold`: int4
- `cooldown_seconds`: int4
- `enabled`: bool
- `updated_at`: timestamptz

Data awal (manual insert 1 row):
- `id = 1`
- `threshold = 25`
- `cooldown_seconds = 60`
- `enabled = true`
- `updated_at = now`

### Tabel: `server_locations`

- `id`: uuid, primary key, default `gen_random_uuid()`
- `name`: text, not null
- `api_url`: text
- `api_key`: text
- `floors`: jsonb, default `[]`
- `address`: text
- `maps_link`: text
- `created_at`: timestamptz, default `now()`
- `updated_at`: timestamptz
- `deleted_at`: timestamptz

### Tabel: `visitor_logs`

- `id`: uuid, primary key, default `gen_random_uuid()`
- `ip_address`: text
- `device`: text
- `browser`: text
- `visited_at`: timestamptz, default `now()`

### Tabel: `temperature_logs`

- `id`: uuid, primary key
- `timestamp`: timestamptz, not null
- `temperature`: float8, not null
- `humidity`: float8, not null
- `location_id`: uuid, not null
- `floor_id`: text, not null
- `created_at`: timestamptz

## 3) RLS / Policy (Mode cepat development)

Kalau masih tahap development, paling cepat:

1. Buka tiap tabel di `Table Editor`.
2. Masuk tab `RLS`.
3. Nonaktifkan RLS dulu untuk tabel di atas.

Untuk production, aktifkan RLS dan bikin policy sesuai role user.

## 4) Catatan Penting

- File client Supabase ada di `src/integrations/supabase/client.ts`.
- Tracking visitor otomatis insert ke tabel `visitor_logs` saat halaman utama dibuka.
- Kalau env belum diisi, console akan memberi warning dan koneksi Supabase tidak akan valid.
