# AGENTS.md — instruksi kerja untuk AI penerus

Baca berurutan SEBELUM menyentuh apa pun:
1. `README.md` (status + layout)
2. `work/file.md` (SEMUA temuan + matriks eksperimen T1–T13)
3. `work/REPORT-isVip.md` (detail patch + Evidence ID REA)

## Aturan repo

- Semua output kerja di `./work/`. Jangan tulis di luar repo kecuali `/tmp`
  (sementara, hilang saat reboot!) dan instalasi APK ke device via adb.
- JANGAN commit: `*.apk`, `apktool-out/`, `apktool-orig/`, `dex/`, `native/`,
  `rom*/` (lihat `.gitignore`). JANGAN commit secret (tidak ada di repo;
  API key hanya di `~/.config/opencode/`, keystore di `~/.android/`).
- Bahasa laporan: Indonesia. Setiap klaim harus menunjuk bukti
  (file log/baris smali/Evidence ID), bukan keyakinan — pelajaran dari
  investigasi ini: asumsi "tentu saja" sempat menyesatkan 2 kali.

## Fakta terkonfirmasi (jangan diselidiki ulang)

- Patch VIP (isVip dkk) BUKAN penyebab boot hang — build logika pristine
  (T4/T6/T7b) hang identik. Bukti: sha dex + `grep -c` marker = 0 di tree T4.
- Error 51 = cert-pin SHA-1 di `libVPhoneGaGaLib.so` `.rodata`
  (arm64 file-offset `0xdaff8`, arm32 `0xbc700`; SATU-SATUNYA kemunculan di
  semua `.so`), dipakai via `memcmp(buf, hash, 20)` di 2 situs
  (arm64 `0x6c2450`, `0x6c3d80`; `w2=0x14`). Bypass: timpa 20 byte dgn SHA-1
  debug key (`6fadb20b…1443`) ATAU patch `blr x8`→`mov w0,#0` (`00008052`).
- Error 71 = timeout `ProgressMonitor("startEngine")`, kode `0x47`, dialog
  `AbnormalType.startProgressIn*Nine*`. Engine: extraction 0→100, spawn guest,
  lalu sunyi; guest `init` parkir di `futex_wait_queue` dalam ashmem shared
  `titan-kspace`; tanpa crash/tombstone.
- Log level Debug milik aplikasi DIFILTER device (0 baris `D Titan` padahal
  call ada). Instrumentasi smali WAJIB pakai `Log.e`/`LogManager.e`.
- `OnGaGaMessage` case 18 = gate material id 5/6/7; materials server KOSONG
  untuk akun non-VIP (`processMaterial: material string empty!`).
  `checkReqFeatures bits=0x0` pada instance uji → alur DOREQ tak jalan.
- Official boot normal bahkan offline → penyebab 100% lokal di build resign.

## Pola patch smali yang aman (terbukti build + boot sampai UI)

- Edit HANYA file di bawah `work/apktool-out/smali_classes3/` (tree VIP)
  atau `work/apktool-orig/` (tree debug). Jangan sentuh resources (decode `-r`).
- `.locals` BOLEH di-bump +1..3 lalu pakai register TERATAS yang baru
  (terbukti aman di puluhan method). JANGAN pakai register tengah tanpa
  bukti dead (wajib baca konteks ±20 baris).
- `invoke-*` NON-range hanya menjangkau v0–v15. Parameter `p1..p3` pada
  method `.locals 15` = v16–v18 → WAJIB `move/from16` dulu atau pakai
  bentuk `/range`. (Dua kali build gagal karena ini.)
- Method static: argumen pertama = `p0` (BUKAN `p1`). Satu kali VerifyError
  karena ini (`DbgLog.e`).
- Komentar `#` hilang di dex — bukti patch harus diverifikasi via
  dekompilasi ulang (REA) atau `baksmali` dex hasil build, bukan via `grep`.

## Frida (17.18.0, gadget arm64, key sama → install timpa)

- Skrip HARUS ES5: `var`, `function`, concat — TANPA backtick/`=>`
  (engine JS gadget menolaknya dengan error samar).
- `Module.*` statis tampak stub di sesi bertabrakan; pakai
  `Process.getModuleByName(...).enumerateExports()` (terbukti jalan).
- SATU sesi dalam satu waktu; `pkill -9 -f frida` bila sesi nyangkut.
  Redirect output + stdin aman: `frida -U Gadget -l s.js > out.txt 2>&1 < /dev/null`
  (tanpa `< /dev/null`, CLI bisa abort saat teardown).
- Gadget di build F11+ load di `MyNativeActivity.onCreate` = proses
  `:instance1` (proses VM). Proses ini BARU LAHIR saat tap Start → attach
  SELALU telat beberapa detik (event 0–2 detik pertama tak tertangkap).
  Untuk observasi sejak t=0, gunakan log smali (`Log.e`), bukan Frida.
- `frida-ps -U | grep -i gadget` untuk verifikasi; SATU Gadget per device
  (jangan injeksi di 2 activity sekaligus — konflik port 27042).
- Thread/process lain (guest kernel `titan_1_*`) TIDAK bisa di-hook
  (proses terpisah, tanpa gadget) — tapi `/proc/<pid>/{status,wchan,syscall}`
  BISA dibaca dari dalam Frida (satu UID) via `java.nio.file.Files`;
  `/proc/<pid>/stack` DITOLAK (permission denied). `wchan` cukup informatif.

## Perintah build (lihat README untuk rantai penuh)

```bash
apktool b work/apktool-out -o work/out.apk
zipalign -f 4 work/out.apk work/aligned.apk
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --key-pass pass:android --out work/signed.apk work/aligned.apk
apksigner verify work/signed.apk
adb install -r work/signed.apk && adb logcat -c
```

## Tugas terbuka (urutan saran)

1. Selesaikan hang 71: kandidat tersisa variations signature-read lain
   (Jawa bersih teraudit; native tinggal yang belum ditemukan) ATAU
   deadlock guest↔host via `titan-kspace` (futex guest tak pernah di-wake;
   skrip `frida-kspacetrace.js` + `frida-guest*.js` siap dipakai ulang).
2. Bila boot jalan: instal build VIP (`isVip` final) dan uji fitur satu per satu;
   ekspektasi jujur — fitur yang butuh entitlement server (materials 5/6/7,
   goods terenkripsi RSA) kemungkinan tetap terkunci.
