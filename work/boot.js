var lib = 'libVPhoneGaGaLib.so';
var mod = Process.getModuleByName(lib);
console.log('[boot] base=' + mod.base);
var exps = mod.enumerateExports();
var addrs = {};
for (var k = 0; k < exps.length; k++) { addrs[exps[k].name] = exps[k].address; }
console.log('[boot] exports=' + exps.length);
function hookJni(nm) {
  var a = addrs[nm] || null;
  if (a === null) { console.log('[boot] NOEXPORT ' + nm); return; }
  Interceptor.attach(a, {
    onEnter: function () { this.t0 = Date.now(); console.log('[boot] ENTER ' + nm); },
    onLeave: function (r) { console.log('[boot] LEAVE ' + nm + ' dt=' + (Date.now() - this.t0) + 'ms'); }
  });
  console.log('[boot] hooked ' + nm);
}
var names = ['Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_InitializeInstance',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_StartGaGaOs',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_InitializeMainProcess',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_SetNativeInfoCommon',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_ContinueStartEngine'];
for (var n = 0; n < names.length; n++) { hookJni(names[n]); }
console.log('[boot] ready');
