// live.js — full boot observation in one session (ES5 only)
var boot0 = Date.now();
function ts() { return ((Date.now() - boot0) / 1000).toFixed(1) + 's'; }
var lib = Process.getModuleByName('libVPhoneGaGaLib.so');
console.log('[live] lib base=' + lib.base);
var exps = lib.enumerateExports();
var addr = {};
for (var k = 0; k < exps.length; k++) { addr[exps[k].name] = exps[k].address; }
function hookJni(nm) {
  if (!addr[nm]) { console.log('[live] NOEXPORT ' + nm); return; }
  Interceptor.attach(addr[nm], {
    onEnter: function () { this.t0 = Date.now(); console.log('[live] ENTER ' + nm); },
    onLeave: function (r) { console.log('[live] LEAVE ' + nm + ' dt=' + (Date.now() - this.t0) + 'ms'); }
  });
  console.log('[live] hooked ' + nm);
}
hookJni('Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_InitializeInstance');
hookJni('Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_StartGaGaOs');
hookJni('Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_SetNativeInfoCommon');
hookJni('Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_ContinueStartEngine');
var offs = [0x6c2460, 0x6c3d88];
for (var j = 0; j < offs.length; j++) {
  (function (off) {
    Interceptor.attach(lib.base.add(off), {
      onEnter: function () { console.log('[live] PIN-SITE hit'); }
    });
  })(offs[j]);
}
console.log('[live] pin watches placed');
var lc = Process.getModuleByName('libc.so');
var lexps = lc.enumerateExports();
var sc = null;
for (var m = 0; m < lexps.length; m++) {
  if (lexps[m].name === 'syscall') { sc = lexps[m].address; break; }
}
var lastWait = {};
Interceptor.attach(sc, {
  onEnter: function (args) {
    var num = args[0].toInt32();
    if (num === 98) {
      var op = args[2].toInt32() & 15;
      var tid = Process.getCurrentThreadId();
      if (op === 0) { lastWait[tid] = '' + args[1]; }
      else if (op === 1) {
        var w = 'WAKE uaddr=' + args[1] + ' tid=' + tid;
        for (var t in lastWait) { if (lastWait[t] === '' + args[1]) { w += ' (MATCHES waiter tid=' + t + ')'; } }
        console.log('[live] ' + w);
      }
    }
  }
});
console.log('[live] futex watch on');
function sym(a) {
  try {
    var d = DebugSymbol.fromAddress(a);
    return a + '!' + (d.moduleName || '?') + ' ' + ((d.name || '') + '').substr(0, 50);
  } catch (e) { return '' + a; }
}
setTimeout(function () {
  console.log('[live] === BACKTRACE @ ' + ts() + ' ===');
  var tls = Process.enumerateThreads();
  for (var i = 0; i < tls.length; i++) {
    (function (t) {
      var nm = '?';
      try { nm = File.readAllText('/proc/self/task/' + t.id + '/comm').replace(/\n/g, ''); } catch (e) {}
      var line = '[live] tid=' + t.id + ' (' + nm + ')';
      try {
        var bt = Thread.backtrace(t.context, Backtracer.ACCURATE);
        var tops = [];
        for (var f = 0; f < 5 && f < bt.length; f++) { tops.push(sym(bt[f])); }
        line += ' :: ' + tops.join(' <- ');
      } catch (e) { line += ' bterr'; }
      console.log(line);
    })(tls[i]);
  }
  console.log('[live] backtrace done');
}, 180000);
console.log('[live] ready');
