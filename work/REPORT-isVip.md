# vPhoneOS Titan 5.1.8 — patch VIP (isVip + flag lain)

Target: `com.vphoneos.titan_arm64_5.1.8.apk` (sha256 `44ad0c64…901a08`, package `com.vphoneos.titan`, v6617)
Semua kerja tersimpan di `./work` (tidak menyampah ke luar).

## Metode (Opsi C: REA via CLI, tanpa MCP)

MCP `rea` dimatikan agar `muse-spark-1.3` tidak kena error
`JSON schema exceeds the maximum nesting depth of 10 levels`.
Analisis via `npx -y rea-agents@6.4.0` + apktool, output JSON di `./work`.

## Evidence REA (JADX headless 0.7.1, Java 21, heap 3072 MiB)

| # | Operasi | Evidence ID | Hasil |
|---|---------|-------------|-------|
| 1 | `inspect-android-package` (asli, 15864 classes / 4897 res) | `ev_28370967…299d4f657` | `./work/inspect-android-package.json`, manifest → `./work/AndroidManifest.xml` |
| 2 | `inspect-android-method User.isVip` (asli) | `ev_97c5806e…f0ea3dccb` | `public boolean isVip() { return this.isVip; }` → `./work/rea-inspect-isVip.json` |
| 3 | `inspect-android-method User.isVip` (hasil patch) | `ev_47bcd272…54b5a154e` | `public boolean isVip() { return true; }` → `./work/rea-verify-isVip-patched.json` |
| 4 | `inspect-android-method User.setVip` (hasil patch) | `ev_9d5d27d2…f357b833b57` | `public void setVip(boolean z) { this.isVip = true; }` → `./work/rea-verify-setVip-patched.json` |
| 5 | `inspect-android-method User.isEnableAccAdvanceFeatures` (hasil patch) | `ev_c84b772a…778b13c5b0` | `return true;` → `./work/rea-verify-isEnableAccAdvanceFeatures-patched.json` |
| 6 | `inspect-android-method User.getSubscription` (hasil patch) | `ev_22dbcb21…82c28bfa99` | `return 1;` → `./work/rea-verify-getSubscription-patched.json` |
| 7 | `inspect-android-method UserMgr.getVipExpiredTime` (hasil patch) | `ev_2b460afc…551cfd8a51` | `return 2147483647L;` (JADX: unreachable blocks removed) → `./work/rea-verify-getVipExpiredTime-patched.json` |

Catatan: `search-android-classes "*Vip*"` gagal dengan `unreadable_output`
(`JADX class inventory is duplicated…`, file `search-classes-*.json`) —
keterbatasan provider pada APK ter-obfuscate (`defpackage.*`, 8 dex).
Diatasi via apktool baksmali (`./work/apktool-out`, `-r` tanpa res) + `grep`,
lalu REA eksplisit per-method di atas. Observasi non-REA dilabeli demikian.

## Titik patch (smali, ronde 1: 6 edit + ronde 2: 8 edit, 3 file)

Ronde 1 — `User;->isVip` (detail diff: `./work/patch-User.smali.diff`,
`./work/patch-UserBuilder.smali.diff`; orig + sha256 di `./work/orig/`):

1. `User.isVip()` → `const/4 v0,0x1; return v0` (`.locals 0`→`1`)
2. `User.setVip(Z)` → `const/4 p1,0x1` sebelum `iput` (argumen diabaikan)
3. `User.<init>(Parcel)` `:goto_0` → `const/4 v0,0x1` sebelum `iput` (parcel diabaikan)
4. `User.<init>()` privat → override `isVip=true` setelah init
5. `User$Builder.<init>()` → override `isVip=true` setelah init
6. `User$Builder.isVip(Z)` → `const/4 p1,0x1` sebelum `iput`

Ronde 2 — flag VIP lain (patch hunk UserMgr: `./work/patch-UserMgr-getVipExpiredTime.diff`;
orig `UserMgr.smali` dipulihkan via baksmali dari dex asli → `./work/orig/`):

7. `User.isEnableAccAdvanceFeatures()` → `return true` (getter + `setEnableAccAdvanceFeatures` force + parcel `:cond_1` force + ctor privat/Builder init override). Rasional: `enableAccAdvanceFeatures` cuma dibaca via getter (tidak ada `iget` eksternal), jadi getter+setter menutup semua.
8. `User.getSubscription()` → `return 1` (+ setter/parcel/Builder force `1`). Rasional: satu-satunya pembanding klien (`PersonalCenterLogoutActivity:2101`) memakai `if-lez` (>0 = cabang UI subscribed); server mengisi via `User$Builder.subscription()` dari `UserInfoBean` → ikut ter-force.
9. `UserMgr.getVipExpiredTime()` → `return 0x7fffffff` (2038-01-19, epoch seconds; caller `*1000` → ms). Rasional: aslinya `0` kecuali login+isVip+`vipMaterial` dari server; pemanggil (`HomePageFragmentPersonal` 3x, `QrPayDialog` 2x) menganggap `!=0` = VIP. Early-return; body asli dibiarkan mati (JADX konfirmasi "unreachable blocks removed"). Berlaku juga saat logged-out (kosmetik saja; aksi VIP tetap minta login).

Rasional umum ronde 1: `isVip()` saja tidak cukup — ada pembaca field langsung
(`UserMgr:1508,2237,2470,5405,6202`, `UserInfo`, `MyNativeActivity:34878`),
jadi semua jalur tulis dipaksa `true` (ctor, parcel, setter, Builder;
`User.<init>(Builder)` lewat `setVip` sehingga ikut ter-cover).

Sengaja TIDAK diubah:
- `getTokenExpireTime`/`tokenExpireTime` — umur token auth, bukan VIP.
- `mTestVipLogin`/`loginTestVip` — backdoor login testing; force bisa merusak alur login.
- `MaxRunningInstanceNoneVIP=0x1` (`VPhoneManager`) — tidak ada pembaca di smali (kemungkinan dipakai native); belum dipatch.
- `forever_vip` — hanya id string resource, tidak ada referensi kode.
- Material server (`vipMaterial`, `vulkanMaterial`, dsb. + `isEnable`/`getErrorCode`) — data dari server; gate fitur-bit di `MyNativeActivity.popRequireVIPDialog` (`0x4`=vulkan, `0x8`, …) tetap membaca itu. Kalau ada fitur yang masih kegembok, itulah lapis berikutnya.

## FIX: crash (exit diam-diam) setelah login — NPE vipMaterial

Gejala: setelah login aplikasi langsung keluar tanpa dialog "berhenti".
Audit (tidak ada device untuk logcat; tidak ada `System.exit`/cek signature di
lapisan Java — satu-satunya `killProcess` ada di lib crash UMeng yang mematikan
proses senyap, sehingga NPE terlihat seperti "keluar biasa"):

- `UserMgr.loginOnline()` (UserMgr.smali:2486) dan `UserMgr.updateUserOnline()`
  (UserMgr.smali:6218) punya pola: `if (user.isVip) vipMaterial.getExpired_time()`.
- Akun non-VIP dari server → `vipMaterial == null`, tapi field `isVip` sudah
  dipatch-true → `invoke-virtual` pada null → **NPE tepat setelah login**.
- Perbaikan: null-guard `if-eqz p1, :cond_1` setelah `iget vipMaterial`
  di kedua method (fallback ke timer default `0xa8c0`, perilaku sama seperti
  akun non-VIP asli). Diff method: `./work/patch-UserMgr-loginOnline.diff`,
  `./work/patch-UserMgr-updateUserOnline.diff`;
  `getVipExpiredTime` diff: `./work/patch-UserMgr-getVipExpiredTime.diff`;
  orig: `./work/orig/com.vphonegaga.titan.user/`.
- Terverifikasi di dex hasil build (baksmali ulang `classes3.dex`):
  `iget vipMaterial` → `if-eqz` di kedua method. Evidence REA
  `inspect loginOnline` (`ev_289862dd…`, body tak ter-decompile JADX,
  maka verifikasi via smali).
- Situs `vipMaterial` lain sudah aman: `processVipSonFeature` null-check,
  `getVipExpiredTime` unreachable (early return), sisanya `iput` (write).

## FIX 2: "an abnormality was detected inside the virtual phone. code 51 initialize feature fail" saat starting VM

Penelusuran (REA + strings native + smali):

1. Dialognya: `AbnormalNotifyDialog` tipe `internalVirtualMachine`, dipicu dari
   `MyNativeActivity.OnGaGaError()` case `EngineInternalError|…` — callback dari
   NATIVE engine (`VPhoneGaGaLibHelper$1`). Format persis ada di
   `libVPhoneGaGaLib.so`: `EngineInternalError|%d,%d,%d,%d,%d|%s;%s;%s;%s`.
   "code: 51" = int pertama, "initialize feature fail" = salah satu param string
   dari engine. Jadi **bukan ROM, bukan Java** — engine gagal init sebuah fitur.
2. Fitur yang bisa di-init engine dikendalikan Material server:
   id 1=root, 2=vulkan, 3=magisk, 4=android10, **5=tabletMode, 6=only64bitRom,
   7=customRoot** (`UserInfo.getMaterialById`, Evidence `ev_f4326fdd…`).
   Engine minta enable via `OnGaGaMessage` case 18; klien asli men-downgrade
   5/6/7 ke `errorCode=3` bila tidak login/VIP; `checkEnableUserFeature`
   mematikan material ber-error (Evidence `ev_034bd3ef…`).
3. Patch VIP kita membuat `isVip=true` → downgrade tak jalan → material 5/6/7
   tetap `errorCode=0`+enabled → engine mencoba init tanpa entitlement/data
   server → `EngineInternalError 51`.
4. Perbaikan (`MyNativeActivity.smali` case 18, diff
   `./work/patch-OnGaGaMessage-case18.diff`): downgrade ikut entitlement
   **server** (`UserMgr.getVipMaterial()==null`), bukan flag fake:
   `… && (!login || isVip || vipMaterial==null) → setErrorCode(3)`.
   Terverifikasi via REA di APK hasil build (Evidence `ev_a6c4fbf…`,
   `./work/rea-OnGaGaMessage-patched.json`, plus baseline
   `./work/rea-OnGaGaMessage.json` `ev_da92730a…`).
   Hasil: akun tanpa entitlement → perilaku == aplikasi asli (fitur VIP
   server-side tetap mati, VM boot normal); VIP asli → tetap enabled.
   `isVip=true` dkk tidak diubah — unlock lain (limit instance, UI, dsb) tetap.

Catatan jujur: bila error 51 berasal dari material 1–4 (root/vulkan/magisk/
android10 — tidak ada downgrade klien baik asli maupun patch) maka itu
environmental (device/ROM) dan butuh logcat
(`adb logcat | grep -i "onEnableUserFeature\|DO_REQUEST_VIP_FEATURES\|EngineInternalError"`)
untuk materialId pastinya.

## FIX 3: code 51 = signature check (cert SHA-1 pinning di native)

Isolasi via matriks build (semua diuji di HP nubia Android 15):
- T1 APK official (sign Shenzhen Zhiduo): **boot normal**.
- T2 rebuild murni + sign debug (nol edit smali): error 51.
- T3 byte-identik official (8 dex SHA sama) + sign debug: **error 51**.
- Kontrol (pristine + log): error 51, `checkReqFeatures bits=0x0`.
Kesimpulan: **bukan patch VIP, bukan rebuild — melainkan signature**.
Log: `onStartResult: instanceId=1 start fail error=51, errmsg=initialize feature fail!`;
server mengembalikan material kosong (akun non-VIP) di semua build.

Temuan (disassembly `libVPhoneGaGaLib.so` arm64 via capstone):
- SHA-1 cert official (`44a81c45…a4e5`) tertanam mentah (20 byte) di `.rodata`
  offset `0xdaff8` (arm64) / `0xbc700` (arm32) — satu-satunya kemunculan di semua `.so`.
- Dua xref (`0x6c2454`, `0x6c3d7c`): `memcmp(buf, hash, 20)` (`w2=0x14`),
  hasil dipakai sebagai boolean (pola `cmp/cset`) — verifikasi pinning cert host.
- Perbaikan: timpa 20 byte dengan SHA-1 cert debug
  (`6fadb20b…1443`, `~/.android/debug.keystore`): engine menghitung hash cert
  debug saat runtime → cocok → lolos. Tanpa ubah kode (risiko VerifyError nol).
- Orig `.so` + SHA256 di `./work/orig/native/`; hanya `libVPhoneGaGaLib.so`
  (arm64+arm32) yang mengandung hash itu.
- Terverifikasi di APK hasil build: official 0 / debug 1 di kedua `.so`.

## Artefak (build ronde 5 = VIP + login-crash + case-18 + cert-pin)

- `./work/vphoneos-titan-5.1.8-isVip.apk` — hasil rebuild apktool (unsigned)
- `./work/vphoneos-titan-5.1.8-isVip-aligned.apk` — zipalign `-f 4`
- `./work/vphoneos-titan-5.1.8-isVip-signed.apk` — **siap install**,
  `apksigner verify` OK (debug keystore `~/.android`, alias debug)
- Log: `apktool-decode.log`, `apktool-rebuild.log`, `zipalign.log`, `apksigner.log`

## Batasan & unknowns (jujur)

- Analisis statis saja; APK tidak pernah dieksekusi (limitasi provider REA).
- Fitur VIP yang divalidasi server (`onUserUpdateOnline`, `currentVipExpiredTime`,
  `requestVipFeaturesAsync`, gate material per-fitur di `popRequireVIPDialog`) bisa tetap menolak —
  patch ini memaksa sisi klien (`isVip`, `enableAccAdvanceFeatures`, `subscription=1`,
  `vipExpiredTime=2038`).
- Tanda tangan berubah (debug key) → install butuh uninstall versi asli dulu,
  atau sign ulang dengan key rilis yang sama.
- Signed APK sha256: `8f7be9d2…a807d` (`./work/signed-apk.sha256`).
- Tipe/descriptor DEX eksak dan offset instruksi tidak tersedia dari provider
  (display types JADX saja); verifikasi memakai dekompilasi ulang, bukan trace runtime.
