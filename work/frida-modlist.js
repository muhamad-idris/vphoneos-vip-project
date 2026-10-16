// modlist.js — list loaded modules during stuck phase (ES5 only)
Java.perform(function () {
  var mods = Process.enumerateModules();
  console.log('[ml] total=' + mods.length);
  for (var i = 0; i < mods.length; i++) {
    var n = mods[i].name;
    if (n.indexOf('umeng') >= 0 || n.indexOf('spy') >= 0 ||
        n.indexOf('monitor') >= 0 || n.indexOf('verify') >= 0 ||
        n.indexOf('protect') >= 0 || n.indexOf('titan') >= 0 ||
        n.indexOf('userkernel') >= 0 || n.indexOf('GaGa') >= 0 ||
        n.indexOf('frida') >= 0 || n.indexOf('gadget') >= 0) {
      console.log('[ml] ' + n + ' @ ' + mods[i].base);
    }
  }
  console.log('[ml] done');
});
