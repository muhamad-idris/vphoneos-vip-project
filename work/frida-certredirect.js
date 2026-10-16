// certredirect.js — redirect engine's base.apk opens to official file (ES5 only)
var OFFICIAL = '/sdcard/official-base.apk';
var offPtr = Memory.allocUtf8String(OFFICIAL);
function isSelfBase(p) {
  return p.indexOf('com.vphoneos.titan') >= 0 && p.indexOf('base.apk') >= 0;
}
function strOf(ptr) {
  try { return Memory.readUtf8String(ptr); } catch (e) { return ''; }
}
var m = Process.getModuleByName('libc.so');
var exps = m.enumerateExports();
var hookNames = ['openat', 'open'];
for (var k = 0; k < exps.length; k++) {
  (function (nm, addr) {
    if (nm !== 'openat' && nm !== 'open') { return; }
    Interceptor.attach(addr, {
      onEnter: function (args) {
        var pathArg = (nm === 'openat') ? args[1] : args[0];
        var p = strOf(pathArg);
        if (isSelfBase(p)) {
          console.log('[rd] REDIRECT ' + nm + ' ' + p);
          if (nm === 'openat') { args[1] = offPtr; }
          else { args[0] = offPtr; }
        }
      }
    });
    console.log('[rd] hooked ' + nm);
  })(exps[k].name, exps[k].address);
}
console.log('[rd] ready, official=' + OFFICIAL);
