// guestspy2.js — POLLING guest procs (attach kapan saja, ES5 only)
function ls(path) {
  try {
    var F = Java.use('java.io.File');
    var arr = F.$new(path).list();
    if (arr === null) return 'NULL';
    var out = [];
    for (var i = 0; i < arr.length; i++) { out.push(arr[i]); }
    return out.join(',');
  } catch (e) { return 'ERR:' + e; }
}
function readAll(path) {
  try {
    var Files = Java.use('java.nio.file.Files');
    var Paths = Java.use('java.nio.file.Paths');
    var P = Paths.get(path, Java.array('java.lang.String', []));
    var b = Files.readAllBytes(P);
    var s = '';
    for (var i = 0; i < b.length; i++) {
      var c = b[i] & 0xff;
      if (c === 10) { s += '|'; }
      else if (c >= 32 && c < 127) { s += String.fromCharCode(c); }
    }
    return s.substr(0, 1500);
  } catch (e) { return 'ERR:' + e; }
}
function scanOnce(tag) {
  console.log('[gs] --- scan ' + tag + ' t=' + Date.now());
  var entries = ls('/proc').split(',');
  var found = [];
  for (var i = 0; i < entries.length; i++) {
    var e2 = entries[i];
    if (!/^[0-9]+$/.test(e2)) { continue; }
    var cmd = readAll('/proc/' + e2 + '/cmdline');
    if (cmd.indexOf('titan_1') >= 0 || cmd.indexOf('libloader') >= 0) {
      found.push(e2);
    }
  }
  console.log('[gs] guest pids: ' + (found.length ? found.join(',') : '(none)'));
  for (var j = 0; j < found.length; j++) {
    (function (pid) {
      console.log('[gs] ' + pid + ' status=' + readAll('/proc/' + pid + '/status').substr(0, 120));
      console.log('[gs] ' + pid + ' wchan=' + readAll('/proc/' + pid + '/wchan'));
      console.log('[gs] ' + pid + ' stack=' + readAll('/proc/' + pid + '/stack'));
    })(found[j]);
  }
}
Java.perform(function () {
  console.log('[gs] polling every 15s, Ctrl+C to stop');
  var n = 0;
  scanOnce('init' + (n++));
  setInterval(function () { scanOnce('t' + (n++)); }, 15000);
});
