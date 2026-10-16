var lib = 'libVPhoneGaGaLib.so';
var mod = Process.getModuleByName(lib);
console.log('[hang] base=' + mod.base);
function sym(addr) {
  try {
    var d = DebugSymbol.fromAddress(addr);
    var m = d.moduleName ? ('!' + d.moduleName) : '';
    var s = d.name ? (d.name + '') : '';
    return addr + m + (s ? (' ' + s.substr(0, 80)) : '');
  } catch (e) { return '' + addr; }
}
var ts = Process.enumerateThreads();
console.log('[hang] threads=' + ts.length);
for (var i = 0; i < ts.length; i++) {
  (function (t) {
    var name = '?';
    try {
      var fs = File.readAllText('/proc/self/task/' + t.id + '/comm');
      name = fs.replace(/\n/g, '');
    } catch (e) {}
    console.log('[hang] --- tid=' + t.id + ' (' + name + ')');
    try {
      var bt = Thread.backtrace(t.context, Backtracer.ACCURATE);
      var n = bt.length > 14 ? 14 : bt.length;
      for (var f = 0; f < n; f++) { console.log('[hang]   #' + f + ' ' + sym(bt[f])); }
    } catch (e) { console.log('[hang]   backtrace err=' + e); }
  })(ts[i]);
}
console.log('[hang] done');
