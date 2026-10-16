# vphoneos-vip-project

Patch VIP + investigasi reverse-engineering untuk
**vPhoneOS Titan 5.1.8** (`com.vphoneos.titan`, versionCode 6617,
APK sumber 2,6 GB, signature resmi Shenzhen Zhiduo).

> Baca dulu: [`work/file.md`](work/file.md) (rangkuman lengkap temuan +
> matriks eksperimen) lalu [`work/REPORT-isVip.md`](work/REPORT-isVip.md)
> (detail per ronde + Evidence ID). Untuk AI yang melanjutkan kerja:
> [`AGENTS.md`](AGENTS.md) (perintah, pola patch, jebakan terkonfirmasi).

## Status jujur (per 16 Okt 2026)

| # | Item | Status |
|---|------|--------|
| 1 | Patch VIP (`isVip`, `enableAccAdvanceFeatures`, `subscription=1`, `vipExpiredTime=2038`) | SELESAI, terverifikasi via REA decompile |
| 2 | Crash NPE setelah login (`vipMaterial` null) | FIXED (null-guard) |
| 3 | Downgrade material 5/6/7 ikut entitlement server | FIXED |
| 4 | Error 51 `initialize feature fail` (cert-pin SHA-1 di `libVPhoneGaGaLib.so`) | AKAR DITEMUKAN + BYPASS (timpa 20 byte / forced-match) |
| 5 | Error 71 (stuck 9% → timeout `startEngine`) di SEMUA build resign | **OPEN — belum selesai** |

Fakta kunci: APK official boot normal (bahkan offline). Semua build resign
(debug key) gagal — 51 sebelum bypass, 71-silent-hang sesudahnya — **termasuk
build berlogika pristine (T4/T6/T7b)**. Jadi patch VIP **bukan** penyebab hang.
Lihat `work/file.md` §5 untuk matriks eliminasi lengkap.

## Isi repo

```
work/
  file.md                 <- RANGKUMAN TEMUAN (mulai di sini)
  REPORT-isVip.md         <- detail per ronde + Evidence ID REA
  patch-*.diff            <- semua patch smali
  frida-*.js             <- skrip observasi Frida (WAJIB ES5, lihat AGENTS.md)
  rea-*.json             <- evidence REA (JADX headless 0.7.1)
  logcat-*.txt, *-build-*.log, apksigner*.log, zipalign*.log
  orig/                  <- backup pre-patch (smali + 2 .so referensi + SHA256SUMS)
  AndroidManifest.xml, apk-contents.txt, action_rules.xml, *.sha256
```

> Catatan: tree `apktool-out/`/`apktool-orig/` dan APK hasil build SENGAJA
> tidak ikut (ratusan GB bila diakumulasi; GitHub menolak file >100 MB).
> Decode ulang dari APK sumber sesuai "Reproduksi" di bawah, lalu terapkan
> `patch-*.diff`.

**Sengaja TIDAK ikut** (lihat `.gitignore`; GitHub menolak file >100 MB):
APK sumber & hasil (2,6 GB), `apktool-out/`, `apktool-orig/` (7,4 GB),
`dex/`, `native/`. Semua regenerable — lihat "Reproduksi" di bawah.
APK sumber tetap lokal di luar repo.

## Toolchain (terverifikasi di mesin ini)

- `rea-agents@6.4.0` via npx (`REA_JADX_MCP_JAR` menunjuk
  `~/.local/share/rea-tools/jadx-headless-mcp-0.7.1-all.jar`), Java 21
- `apktool 2.7.0-dirty` (decode **pakai `-r`**, tanpa resources),
  `zipalign -f 4`, `apksigner` (key `~/.android/debug.keystore`, alias/pass `android`)
- Frida 17.18.0 (tools + gadget `frida-gadget-17.18.0-android-arm64.so` cocok)
- Perangkat uji: nubia Z2469N (arm64-v8a, Android 15), adb USB

## Reproduksi build

```bash
# 1. Decode (jangan tanpa -r)
apktool d -r -f -o work/apktool-out com.vphoneos.titan_arm64_5.1.8.apk
# 2. Terapkan patch: lihat work/patch-*.diff
#    (target: smali_classes3/com/vphonegaga/titan/user/User.smali,
#     User$Builder.smali, UserMgr.smali, MyNativeActivity.smali (case 18))
# 3. Cert-pin bypass: timpa 20 byte SHA-1 official
#    44a81c45451d624bdde29ec865a8bf2026f3a4e5
#    -> SHA-1 debug key di lib/arm64-v8a + lib/armeabi-v7a/libVPhoneGaGaLib.so
# 4. Rebuild + sign
apktool b work/apktool-out -o work/out.apk
zipalign -f 4 work/out.apk work/aligned.apk
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --key-pass pass:android --out work/signed.apk work/aligned.apk
apksigner verify work/signed.apk
adb install -r work/signed.apk
```

## Petunjuk operasional (ringkas; lengkap di AGENTS.md)

- Semua output kerja HARUS di `./work/` (aturan repo).
- Logcat device memfilter log level Debug milik aplikasi — pakai `Log.e` /
  `LogManager.e` untuk instrumentasi ( level `D` tidak pernah muncul).
- Skrip Frida HARUS ES5 (`var`/`function`/concat; tanpa backtick/`=>`).
- Satu sesi Frida dalam satu waktu; gadget load di `MyNativeActivity.onCreate`
  = proses `:instance1` (proses VM), BUKAN proses main.
