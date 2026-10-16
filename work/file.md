# vPhoneOS Titan 5.1.8 — Rangkuman Investigasi & Patch

Target: `com.vphoneos.titan_arm64_5.1.8.apk` (2,6 GB, package `com.vphoneos.titan`,
v6617, sha256 `44ad0c64…901a08`, sign resmi Shenzhen Zhiduo).
Tujuan awal: patch `isVip=true` (+ flag VIP lain). Semua kerja di `./work`.
Perangkat uji: nubia Z2469N (arm64, Android 15), akun **gratis/non-VIP**.

Metode: REA via CLI (`rea-agents@6.4.0`, Opsi C — MCP dimatikan karena
`muse-spark-1.3` menolak schema depth >10), apktool 2.7.0, Frida 17.18.0.

---

## 1. Model VIP di kode (bukti REA) — PATCH SELESAI, terverifikasi

- `User.isVip()` return field; `setVip`, `isEnableAccAdvanceFeatures`,
  `getSubscription`, `UserMgr.getVipExpiredTime` — Evidence:
  `ev_28370967` (package, 15864 class), `ev_97c5806e` (isVip asli),
  `ev_47bcd272` + `ev_9d5d27d2` (hasil patch), `ev_c84b772a` (advance),
  `ev_22dbcb21` (subscription=1), `ev_2b460afc` (expiry 2038),
  `ev_034bd3ef` (checkEnableUserFeature), `ev_f4326fdd` (material id
  1=root 2=vulkan 3=magisk 4=android10 **5=tabletMode 6=only64bitRom
  7=customRoot**), `ev_da92730a`/`ev_a6c4fbf` (OnGaGaMessage).
- Patch smali (diff di `patch-*.diff`, orig di `orig/`):
  - Ronde 1: `isVip()`→true, `setVip`→force, parcel/default-ctor/Builder → true.
  - Ronde 2: `isEnableAccAdvanceFeatures()`→true (+setter/parcel/Builder),
    `getSubscription()`→1 (+setter/parcel/Builder),
    `getVipExpiredTime()`→0x7fffffff/2038.
- Sengaja TIDAK diubah: `tokenExpireTime`, `mTestVipLogin`,
  `MaxRunningInstanceNoneVIP` (tak ada pembaca), `forever_vip` (cuma string),
  Material server.

## 2. Crash setelah login (exit diam-diam) — FIXED

- Sebab: `UserMgr.loginOnline()` + `updateUserOnline()` pola
  `if (user.isVip) vipMaterial.getExpired_time()` → vipMaterial null
  (server kirim kosong utk non-VIP) → NPE; dibungkam handler crash UMeng
  sehingga terlihat "keluar biasa". Anti-tamper signature: TIDAK ADA di Java.
- Fix: null-guard `if-eqz p1, :cond_1` di kedua method
  (diff `patch-UserMgr-loginOnline.diff`, `patch-UserMgr-updateUserOnline.diff`).

## 3. Gate fitur 5/6/7 (case 18) — FIXED

- `OnGaGaMessage` case 18: `(id 5/6/7) && err==0 && (!login || !isVip)` →
  `setErrorCode(3)`. Patch kita merusak downgrade → engine coba init fitur
  tanpa entitlement → `EngineInternalError`.
- Fix: downgrade ikut entitlement server (`vipMaterial==null`)
  (diff `patch-OnGaGaMessage-case18.diff`).

## 4. Error 51 `initialize feature fail` — AKAR DITEMUKAN + BYPASS

- Pesan dari NATIVE (`libVPhoneGaGaLib.so` berisi format
  `EngineInternalError|%d,...|%s;...`) via callback `OnGaGaError`.
- SHA-1 cert official (`44a81c45…a4e5`) tertanam mentah 20 byte di `.rodata`
  (arm64 `0xdaff8`, arm32 `0xbc700` — satu-satunya kemunculan di semua `.so`),
  dibandingkan via `memcmp(buf, hash, 20)` di 2 situs (`0x6c2454`, `0x6c3d80`;
  hasil dipakai sebagai boolean). Bypass v1: timpa 20 byte dgn SHA-1 debug
  (`6fadb20b…1443`) — tanpa ubah kode.
- Matriks build membuktikan: T1 official boot OK; T2 rebuild-murni+debug-sign,
  T3 (byte-identik official + debug-sign) → error 51 cepat. Jadi 51 = pin ini.

## 5. Error 71 (stuck 9% → timeout `startEngine`) — BELUM SELESAI (open)

Fakta (APK kontrol T4 = logika pristine + hashfix, diverifikasi 0 marker):
- Engine lapor progres extraction 0→100, `InitializeInstance` return true,
  guest spawn (`kernel`+`init`), lalu SUNYI → timeout checkpoint
  (`ProgressMonitor`, dialog kode `0x47`=71).
- Guest `init` parkir di `futex_wait_queue` TAK TERBATAS di memori **shared**
  ashmem `titan-kspace`, tanpa child process; host idle (semua thread parkir
  normal: looper/binder/epoll/futex); tanpa crash (tombstone nihil);
  tanpa network-wait (koneksi HTTPS normal, airplane tidak mengubah);
  ROM/assets/resources/manifest CRC-identik; permission/RAM/state sudah
  di-reset (reboot, pm-clear, semua ROM 7/10/12 dicoba).
- Yang SUDAH gugur via eksperimen: patch VIP (T4 pristine ikut hang),
  rebuild apktool (T7b dex 100% official ikut hang), isi hash (T6 official-bytes
  + forced-match ikut hang), state basi, permission, RAM, server
  (official boot OFFLINE — tapi catatan: uji airplane kita sempat terkontaminasi
  indikator 4G; butuh verifikasi offline ketat bila dibuka lagi).
- Tersisa: pembacaan signature KEDUA yang belum ketemu (Java bersih;
  SHA/MD5/SHA256/dex-hash/installer/LVL: nihil; file sig tidak dibuka saat boot
  (trace Frida, dengan catatan attach telat); pin ROM-guest di chunk
  terkompresi belum terbukti), atau interaksi guest↔host yang gagal
  (channel `titan-pipe-*` + `process-worker-client` sempat nyangkut CONNECTING).

## 6. Artefak yang disimpan (16 GB)

- Source tree: `apktool-out/` (patch VIP), `apktool-orig/` (pristine + debug).
- Final: `vphoneos-titan-5.1.8-isVip-signed.apk` (VIP+hashfix),
  `vphoneos-titan-5.1.8-T7-noapktool-signed.apk` (kontrol dex-official),
  `vphoneos-titan-5.1.8-F13-nosleep-signed.apk` (debug+Frida, terinstall).
- Evidence: `rea-*.json`, `logcat-*.txt`, `frida-*.js`, `*.diff`, `orig/`,
  `dex/`, `native/`, `REPORT-isVip.md` (detail per-ronde).
- Dihapus (±63 GB): APK unsigned/aligned/intermediat (T2–T6, T8–T12, F10/F11,
  CONTROL), `rom12/` (dapat diekstrak ulang), `.idsig`.

## 7. Langkah berikut yang masuk akal

1. Lacak kreasi/isi awal `titan-kspace` (siapa menulis apa sebelum guest spawn;
   butuh hook `ioctlashmem`/`mmap` saat boot — skrip `frida-kspacetrace.js` ada,
   tapi hook sistem-wide memperlambat; batasi ke window spawn).
2. Bandingkan urutan boot official vs patch pada level socket/process
   (butuh install official lagi — mahal, terakhir bila perlu).
3. Bila (1) menunjukkan bytes cert di kspace → netralkan sumbernya
   (alihkan isi / paksa path yang tidak membandingkan).
