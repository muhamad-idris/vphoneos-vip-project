// futex.js — trace FUTEX_WAIT vs FUTEX_WAKE (ES5 only)
var m = Process.getModuleByName('libc.so');
var exps = m.enumerateExports();
var sc = null;
for (var k = 0; k < exps.length; k++) {
  if (exps[k].name === 'syscall') { sc = exps[k].address; break; }
}
if (sc === null) { console.log('[fx] no syscall export'); }
else {
  console.log('[fx] syscall @ ' + sc);
  Interceptor.attach(sc, {
    onEnter: function (args) {
      var num = args[0].toInt32();
      if (num === 98) {
        var op = args[2].toInt32() & 15;
        if (op === 0) {
          console.log('[fx] WAIT uaddr=' + args[1] + ' val=' + args[3] + ' timeout=' + args[4] + ' tid=' + Process.getCurrentThreadId());
        } else if (op === 1) {
          console.log('[fx] WAKE uaddr=' + args[1] + ' n=' + args[3] + ' tid=' + Process.getCurrentThreadId());
        }
      }
    }
  });
  console.log('[fx] tracing');
}
