// kfind.js — scan host-side titan-kspace for debug cert hash (ES5 only)
function readAll(path) {
  try {
    var Files = Java.use('java.nio.file.Files');
    var Paths = Java.use('java.nio.file.Paths');
    var P = Paths.get(path, Java.array('java.lang.String', []));
    var b = Files.readAllBytes(P);
    var s = '';
    for (var i = 0; i < b.length; i++) {
      var c = b[i] & 0xff;
      if (c === 10) { s += '\n'; }
      else if (c >= 32 && c < 127) { s += String.fromCharCode(c); }
    }
    return s;
  } catch (e) { return 'ERR:' + e; }
}
Java.perform(function () {
  console.log('[kf] start');
  var maps = readAll('/proc/self/maps').split('\n');
  console.log('[kf] self maplines=' + maps.length + ' first=' + maps[0].substr(0, 80));
  var ash = 0;
  for (var a = 0; a < maps.length; a++) { if (maps[a].indexOf('ashmem') >= 0) { ash++; } }
  console.log('[kf] self ashmem lines=' + ash);
  var found = 0;
  for (var i = 0; i < maps.length; i++) {
    if (maps[i].indexOf('titan-kspace') < 0) { continue; }
    console.log('[kf] MAP: ' + maps[i].substr(0, 160));
    var parts = maps[i].split(' ');
    var range = parts[0].split('-');
    var base = parseInt(range[0], 16);
    var end = parseInt(range[1], 16);
    var size = end - base;
    console.log('[kf] base=' + range[0] + ' size=' + size);
    if (size > 0 && size < 0x80000000) {
      try {
        var res = Memory.scanSync(ptr(base), size, '6f ad b2 0b bf e5 87 44 ff b8 b9 9e 2c 6c 35 31 bb 05 14 43');
        console.log('[kf] debug-hash hits=' + res.length);
        for (var h = 0; h < res.length && h < 5; h++) {
          console.log('[kf] HIT at +' + (res[h].address.sub(base)).toString() + ' ctx=' + Memory.readByteArray(res[h].address.sub(16), 64));
        }
        found += res.length;
      } catch (e) { console.log('[kf] scan err=' + e); }
    }
  }
  console.log('[kf] done total=' + found);
});
