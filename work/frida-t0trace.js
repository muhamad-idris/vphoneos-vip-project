// t0trace.js — openat filter + pin + boundary from t=0 (ES5 only)
var hitCount = 0;
function interesting(p) {
  return (p.indexOf('CERT') >= 0 || p.indexOf('.RSA') >= 0 ||
    p.indexOf('.SF') >= 0 || p.indexOf('MANIFEST') >= 0 ||
    p.indexOf('base.apk') >= 0 || p.indexOf('sign') >= 0 ||
    p.indexOf('Sign') >= 0 || p.indexOf('licen') >= 0 ||
    p.indexOf('verify') >= 0 || p.indexOf('.odex') >= 0 ||
    p.indexOf('.vdex') >= 0 || p.indexOf('.art') >= 0 ||
    p.indexOf('.RSA') >= 0);
}
function strOf(ptr) {
  try { return Memory.readUtf8String(ptr); } catch (e) { return ''; }
}
var m = Process.getModuleByName('libc.so');
var exps = m.enumerateExports();
for (var k = 0; k < exps.length; k++) {
  (function (nm, addr) {
    if (nm !== 'openat' && nm !== 'open') { return; }
    Interceptor.attach(addr, {
      onEnter: function (args) {
        var p = (nm === 'openat') ? strOf(args[1]) : strOf(args[0]);
        if (interesting(p)) {
          hitCount++;
          console.log('[t0] OPEN(' + nm + ') ' + p + ' tid=' + Process.getCurrentThreadId());
        }
      }
    });
    console.log('[t0] hooked ' + nm);
  })(exps[k].name, exps[k].address);
}
var lib = Process.getModuleByName('libVPhoneGaGaLib.so');
console.log('[t0] lib base=' + lib.base);
var offs = [0x6c2460, 0x6c3d88];
for (var j = 0; j < offs.length; j++) {
  (function (off) {
    Interceptor.attach(lib.base.add(off), {
      onEnter: function (args) {
        var b0 = '?', b1 = '?';
        try {
          var ha = [], hb = [], i;
          for (i = 0; i < 4; i++) { ha.push(Memory.readU8(args[0].add(i))); }
          for (i = 0; i < 4; i++) { hb.push(Memory.readU8(args[1].add(i))); }
          b0 = ha.join(','); b1 = hb.join(',');
        } catch (e) {}
        console.log('[t0] PIN-SITE first4 buf=[' + b0 + '] ref=[' + b1 + ']');
      }
    });
  })(offs[j]);
}
console.log('[t0] ready');
