// pinbuf.js — dump the 20-byte buffer compared at pin sites (ES5 only)
var lib = Process.getModuleByName('libVPhoneGaGaLib.so');
console.log('[pb] base=' + lib.base);
function hex(b, n) {
  var s = '';
  for (var i = 0; i < n; i++) {
    var h = (b[i] & 0xff).toString(16);
    if (h.length < 2) { h = '0' + h; }
    s += h;
  }
  return s;
}
var offs = [0x6c2460, 0x6c3d88];
for (var j = 0; j < offs.length; j++) {
  (function (off) {
    Interceptor.attach(lib.base.add(off), {
      onEnter: function (args) {
        var buf = null, ref = null;
        try { buf = hex(Memory.readByteArray(args[0], 20), 20); } catch (e) { buf = 'ERR:' + e; }
        try { ref = hex(Memory.readByteArray(args[1], 20), 20); } catch (e) { ref = 'ERR:' + e; }
        console.log('[pb] site ' + off.toString(16) + ' buf=' + buf + ' ref=' + ref);
      }
    });
    console.log('[pb] hooked ' + off.toString(16));
  })(offs[j]);
}
console.log('[pb] ready');
