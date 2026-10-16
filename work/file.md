# vPhoneOS Titan 5.1.8 — Temuan terkonfirmasi (mulai dari sini)

Target: `com.vphoneos.titan_arm64_5.1.8.apk` (2,6 GB, `com.vphoneos.titan`,
versionCode 6617; APK + kedua tree apktool sudah dihapus dari repo agar ringan
— decode ulang dari APK sumber bila perlu, lihat "Reproduksi" di bawah).
Detail lengkap: `REPORT-isVip.md`. Semua patch dalam bentuk
`patch-*.diff` + backup di `orig/`.

## 1. Model VIP — PATCH SELESAI, terverifikasi via REA

- `User.isVip()` mengembalikan field `isVip:Z`; setter `setVip(Z)`.
  Flag terkait: `enableAccAdvanceFeatures:Z`, `subscription:I`
  (cabang UI subscribed = `> 0`), `UserMgr.getVipExpiredTime():J`.
  Evidence REA: `ev_97c5806e` (asli), `ev_47bcd272` + `ev_9d5d27d2` (hasil patch),
  `ev_c84b772a`, `ev_22dbcb21`, `ev_2b460afc`.
- Patch (6 edit ronde 1 + 8 edit ronde 2, 3 file):
  `User.smali` (`isVip()`→`return true`, `setVip`/`setEnableAccAdvanceFeatures`/
  `setSubscription` force, ctor privat+parcel override),
  `User$Builder.smali` (init + setter force),
  `UserMgr.smali` (`getVipExpiredTime()`→`0x7fffffff`/2038).
- Pembaca field langsung ADA (tidak cukup patch getter saja):
  `UserMgr` (5 situs), `UserInfo`, `MyNativeActivity`, `VPhoneManager:44371`
  (batas 1 instance non-VIP) — makanya semua jalur TULIS dipaksa true.
- Sengaja TIDAK diubah: `tokenExpireTime`, `mTestVipLogin`,
  `MaxRunningInstanceNoneVIP` (tak ada pembaca), `forever_vip` (string saja).

## 2. Crash NPE setelah login — FIXED

- `UserMgr.loginOnline()` + `updateUserOnline()`: pola
  `if (user.isVip) vipMaterial.getExpired_time()` → `vipMaterial` null
  (server kirim string kosong utk non-VIP) → NPE; dibungkam handler UMeng
  sehingga terlihat "keluar biasa". Tidak ada cek signature di Java.
- Fix: null-guard `if-eqz p1, :cond_1` sesudah `iget vipMaterial`
  (diff `patch-UserMgr-loginOnline.diff`, `patch-UserMgr-updateUserOnline.diff`).

## 3. Gate fitur server (materials 1–7) — DIPAHAMI + dinetralkan

- `OnGaGaMessage` case 18: material id 5=tabletMode, 6=only64bitRom,
  7=customRoot di-downgrade ke `errorCode=3` bila tidak login/VIP
  (Evidence `ev_f4326fdd`, `ev_034bd3ef`, `ev_da92730a`).
- Materials server KOSONG untuk akun non-VIP
  (`processMaterial: material string empty!`).
- Fix: downgrade ikut entitlement server (`vipMaterial==null`)
  (diff `patch-OnGaGaMessage-case18.diff`; Evidence hasil `ev_a6c4fbf`).

## 4. Error 51 `initialize feature fail` — AKAR DITEMUKAN + BYPASS

- Pesan dari NATIVE (`libVPhoneGaGaLib.so` berisi format
  `EngineInternalError|%d,...|%s;...`) via callback `OnGaGaError`.
- SHA-1 cert official (`44a81c45…a4e5`) tertanam mentah 20 byte di `.rodata`
  (arm64 file-offset `0xdaff8`, arm32 `0xbc700`; satu-satunya kemunculan di
  semua `.so`), dibandingkan via `memcmp(buf, hash, 20)` di 2 situs
  (arm64 `0x6c2450`, `0x6c3d80`; `w2=0x14`; hasil dipakai sebagai boolean).
  Cara baca cert oleh native: path APK dilewat lewat
  `InitializeMainProcess(Context, ClassLoader, getPackageResourcePath())`.
- Bypass (tanpa ubah kode, risiko VerifyError nol): timpa 20 byte dengan
  SHA-1 debug key (`6fadb20b…1443`) ATAU patch `blr x8`→`mov w0,#0`
  (`00008052`). Terbukti menghilangkan error 51 di device.
- Catatan: beharapkan pin KEDUA tidak ditemukan (scan SHA-1/SHA-256/MD5,
  dex-hash, installer, LVL, file signature saat boot via Frida: nihil).

## 5. Status terbuka (bukan temuan sukses — dicatat agar tidak diulang)

- Error 71 (stuck → timeout `startEngine`, kode `0x47`): terjadi di SEMUA
  build resign termasuk logika pristine → BUKAN akibat patch VIP.
  Detail lengkap upaya eliminasi ada di git history / laporan lama —
  intinya belum selesai. Kandidat terakhir yang belum tuntas:
  deadlock guest↔host via ashmem `titan-kspace`
  (guest `init` parkir `futex_wait_queue`; skrip siap pakai:
  `frida-kspacetrace.js`, `frida-guest*.js`, `frida-combo.js`).

## Reproduksi (mulai dari nol)

```bash
apktool d -r -f -o work/apktool-out com.vphoneos.titan_arm64_5.1.8.apk
# terapkan work/patch-*.diff ke smali_classes3/ + timpa 20 byte hash di
# lib/arm64-v8a + lib/armeabi-v7a/libVPhoneGaGaLib.so
apktool b work/apktool-out -o work/out.apk
zipalign -f 4 work/out.apk work/aligned.apk
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --key-pass pass:android --out work/signed.apk work/aligned.apk
apksigner verify work/signed.apk
adb install -r work/signed.apk && adb logcat -c
```

Aturan pola patch smali + Frida + build ada di `../AGENTS.md`.
