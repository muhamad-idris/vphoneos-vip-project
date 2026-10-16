// guestspy.js — inspect guest kernel/init procs from inside :instance1 (same UID sees /proc)
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
    return s.substr(0, 3000);
  } catch (e) { return 'ERR:' + e; }
}
Java.perform(function () {
  console.log('[gs] start');
  var raw = ls('/proc');
  var entries = raw.split(',');
  console.log('[gs] proc entries count=' + entries.length);
  var found = [];
  for (var i = 0; i < entries.length; i++) {
    var e2 = entries[i];
    if (!/^[0-9]+$/.test(e2)) { continue; }
    var cmd = readAll('/proc/' + e2 + '/cmdline');
    if (cmd.indexOf('titan_1') >= 0 || cmd.indexOf('libloader') >= 0) {
      found.push(e2);
      console.log('[gs] pid=' + e2 + ' cmd=' + cmd.substr(0, 120));
    }
  }
  console.log('[gs] guest pids: ' + found.join(','));
  for (var j = 0; j < found.length; j++) {
    (function (pid) {
      console.log('[gs] === ' + pid + ' status: ' + readAll('/proc/' + pid + '/status').substr(0, 200));
      console.log('[gs] === ' + pid + ' wchan: ' + readAll('/proc/' + pid + '/wchan'));
      console.log('[gs] === ' + pid + ' stack: ' + readAll('/proc/' + pid + '/stack'));
    })(found[j]);
  }
  console.log('[gs] done');
});
