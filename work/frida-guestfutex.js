// guestfutex.js — read /proc/PID/syscall + task stacks for guest pids (ES5 only)
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
    return s.substr(0, 2000);
  } catch (e) { return 'ERR:' + e; }
}
function lsNums() {
  var out = [];
  try {
    var F = Java.use('java.io.File');
    var arr = F.$new('/proc').list();
    for (var i = 0; i < arr.length; i++) {
      if (/^[0-9]+$/.test(arr[i])) { out.push(arr[i]); }
    }
  } catch (e) {}
  return out;
}
Java.perform(function () {
  console.log('[gf] start');
  var entries = lsNums();
  for (var i = 0; i < entries.length; i++) {
    (function (pid) {
      var cmd = readAll('/proc/' + pid + '/cmdline');
      if (cmd.indexOf('titan_1') < 0 && cmd.indexOf('libloader') < 0) { return; }
      console.log('[gf] pid=' + pid + ' cmd=' + cmd.substr(0, 80));
      console.log('[gf] ' + pid + ' wchan=' + readAll('/proc/' + pid + '/wchan'));
      console.log('[gf] ' + pid + ' syscall=' + readAll('/proc/' + pid + '/syscall'));
      var tasks = [];
      try {
        var F2 = Java.use('java.io.File');
        var ta = F2.$new('/proc/' + pid + '/task').list();
        for (var t = 0; t < ta.length; t++) { tasks.push(ta[t]); }
      } catch (e) {}
      console.log('[gf] ' + pid + ' tasks=' + tasks.join(','));
      for (var j = 0; j < tasks.length; j++) {
        (function (tid) {
          console.log('[gf] ' + pid + '/' + tid +
            ' wchan=' + readAll('/proc/' + pid + '/task/' + tid + '/wchan') +
            ' syscall=' + readAll('/proc/' + pid + '/task/' + tid + '/syscall'));
        })(tasks[j]);
      }
    })(entries[i]);
  }
  console.log('[gf] done');
});
