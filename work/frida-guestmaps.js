// guestmaps.js — find which mapping holds the stuck futex (ES5 only)
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
function parseAddr(h) {
  try { return parseInt(h, 16); } catch (e) { return -1; }
}
Java.perform(function () {
  console.log('[gm] start');
  var target = 0xb0463698;
  var F = Java.use('java.io.File');
  var arr = F.$new('/proc').list();
  for (var i = 0; i < arr.length; i++) {
    var pid = arr[i];
    if (!/^[0-9]+$/.test(pid)) { continue; }
    var cmd = readAll('/proc/' + pid + '/cmdline').substr(0, 80);
    if (cmd.indexOf('titan_1_64_1:init') < 0) { continue; }
    console.log('[gm] init pid=' + pid);
    var sc = readAll('/proc/' + pid + '/syscall').split(' ');
    console.log('[gm] syscall head=' + sc.slice(0, 4).join(' '));
    var target = (sc[0] === '98' && sc[1]) ? parseAddr(sc[1]) : 0xb0463698;
    console.log('[gm] futex target=' + sc[1]);
    var maps = readAll('/proc/' + pid + '/maps').split('\n');
    console.log('[gm] maplines=' + maps.length);
    for (var m = 0; m < maps.length; m++) {
      var parts = maps[m].split(' ');
      if (parts.length < 1) { continue; }
      var range = parts[0].split('-');
      if (range.length < 2) { continue; }
      var lo = parseAddr(range[0]);
      var hi = parseAddr(range[1]);
      if (target >= lo && target < hi) {
        console.log('[gm] FUTEX-MAP: ' + maps[m].substr(0, 200));
      }
    }
  }
  console.log('[gm] done');
});
