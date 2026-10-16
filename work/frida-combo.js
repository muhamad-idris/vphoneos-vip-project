// combo.js — futex trace + delayed backtrace in one session (ES5 only)
var m = Process.getModuleByName('libc.so');
var target = null;
var exps = m.enumerateExports();
for (var k = 0; k < exps.length; k++) {
  if (exps[k].name === 'syscall') { target = exps[k].address; break; }
}
console.log('[combo] syscall @ ' + target);
function sym(addr) {
  try {
    var d = DebugSymbol.fromAddress(addr);
    return addr + '!' + (d.moduleName || '?') + ' ' + ((d.name || '') + '').substr(0, 60);
  } catch (e) { return '' + addr; }
}
Interceptor.attach(target, {
  onEnter: function (args) {
    var num = args[0].toInt32();
    if (num === 98) {
      var op = args[2].toInt32() & 15;
      if (op === 0) {
        console.log('[combo] WAIT uaddr=' + args[1] + ' tid=' + Process.getCurrentThreadId());
      } else if (op === 1) {
        console.log('[combo] WAKE uaddr=' + args[1] + ' tid=' + Process.getCurrentThreadId());
      }
    }
  }
});
console.log('[combo] tracing; backtrace in 40s');
setTimeout(function () {
  console.log('[combo] === BACKTRACE DUMP ===');
  var ts = Process.enumerateThreads();
  for (var i = 0; i < ts.length; i++) {
    (function (t) {
      var nm = '?';
      try { nm = File.readAllText('/proc/self/task/' + t.id + '/comm').replace(/\n/g, ''); } catch (e) {}
      var line = '[combo] tid=' + t.id + ' (' + nm + ')';
      try {
        var bt = Thread.backtrace(t.context, Backtracer.ACCURATE);
        var tops = [];
        for (var f = 0; f < 4 && f < bt.length; f++) { tops.push(sym(bt[f])); }
        line += ' :: ' + tops.join(' <- ');
      } catch (e) { line += ' bterr=' + e; }
      console.log(line);
    })(ts[i]);
  }
  console.log('[combo] done');
}, 40000);
