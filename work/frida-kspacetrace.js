// kspacetrace.js — track ashmem kspace lifecycle + content (ES5 only)
var fds = {};
function strOf(p) { try { return Memory.readUtf8String(p); } catch (e) { return ''; } }
function hexN(ptr, n) {
  var s = '';
  try {
    for (var i = 0; i < n; i++) {
      var h = Memory.readU8(ptr.add(i)).toString(16);
      if (h.length < 2) { h = '0' + h; }
      s += h;
    }
  } catch (e) { s += 'ERR'; }
  return s;
}
var m = Process.getModuleByName('libc.so');
var exps = m.enumerateExports();
var hooks = {};
for (var k = 0; k < exps.length; k++) { hooks[exps[k].name] = exps[k].address; }
console.log('[ks] openat=' + hooks['openat'] + ' ioctl=' + hooks['ioctl'] + ' mmap=' + hooks['mmap'] + ' write=' + hooks['write']);
if (!hooks['openat'] || !hooks['ioctl'] || !hooks['mmap'] || !hooks['write']) {
  console.log('[ks] MISSING HOOK, abort');
} else {
Interceptor.attach(hooks['openat'], {
  onEnter: function (args) {
    var p = strOf(args[1]);
    if (p === '/dev/ashmem') { this.ashmem = true; }
  },
  onLeave: function (r) {
    if (this.ashmem && r.toInt32() > 0) {
      fds[r.toInt32()] = '?';
      console.log('[ks] ashmem open fd=' + r.toInt32());
    }
  }
});
Interceptor.attach(hooks['ioctl'], {
  onEnter: function (args) {
    var fd = args[0].toInt32(), req = args[1].toInt32() >>> 0;
    if (fds[fd] !== undefined && req === 0x46780101) {
      var nm = strOf(args[2]);
      fds[fd] = nm;
      console.log('[ks] SET_NAME fd=' + fd + ' name=' + nm);
    }
    if (req === 0x40086665 || req === 0x80086665) {
      console.log('[ks] ioctl req=' + req.toString(16) + ' fd=' + fd);
    }
  }
});
Interceptor.attach(hooks['mmap'], {
  onEnter: function (args) {
    this.fd = args[4].toInt32();
    this.len = args[1].toInt32();
  },
  onLeave: function (r) {
    if (fds[this.fd] !== undefined) {
      console.log('[ks] mmap fd=' + this.fd + ' (' + fds[this.fd] + ') len=' + this.len + ' addr=' + r);
    }
  }
});
Interceptor.attach(hooks['write'], {
  onEnter: function (args) {
    var fd = args[0].toInt32();
    if (fds[fd] !== undefined) {
      console.log('[ks] write fd=' + fd + ' (' + fds[fd] + ') n=' + args[2].toInt32() + ' head=' + hexN(args[1], 32));
    }
  }
});
}
console.log('[ks] watching');
