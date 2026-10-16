// sigopen.js — catch engine opening APK signature files (ES5 only)
var m = Process.getModuleByName('libc.so');
var exps = m.enumerateExports();
var addr = null;
for (var k = 0; k < exps.length; k++) {
  if (exps[k].name === 'openat' || exps[k].name === '__openat_2') { addr = exps[k].address; break; }
}
console.log('[so] openat @ ' + addr);
function isSigPath(pathname) {
  var s = '' + pathname;
  return (s.indexOf('META-INF') >= 0 || s.indexOf('CERT') >= 0 ||
    s.indexOf('.RSA') >= 0 || s.indexOf('.SF') >= 0 ||
    s.indexOf('MANIFEST') >= 0 || s.indexOf('base.apk') >= 0 ||
    s.indexOf('sign') >= 0 || s.indexOf('Sign') >= 0);
}
Interceptor.attach(addr, {
  onEnter: function (args) {
    var p = '(null)';
    try { p = Memory.readUtf8String(args[1]); } catch (e) {}
    if (isSigPath(p)) {
      console.log('[so] OPEN ' + p + ' tid=' + Process.getCurrentThreadId());
      try {
        var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
        for (var f = 0; f < 6 && f < bt.length; f++) {
          var d = DebugSymbol.fromAddress(bt[f]);
          console.log('[so]   #' + f + ' ' + bt[f] + ' ' + (d.moduleName || '?') + ' ' + ((d.name || '') + '').substr(0, 70));
        }
      } catch (e) { console.log('[so] bterr=' + e); }
    }
  }
});
console.log('[so] watching');
