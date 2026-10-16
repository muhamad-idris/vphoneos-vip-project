// F10 boot observer (ES5 only for gadget runtime)
var libName = 'libVPhoneGaGaLib.so';
function ts() { return '' + Date.now(); }
var mod = Process.getModuleByName(libName);
console.log('[boot] ' + libName + ' base=' + mod.base + ' size=' + mod.size);
var _exps = {};
var _list = mod.enumerateExports();
for (var k = 0; k < _list.length; k++) { _exps[_list[k].name] = _list[k].address; }
console.log('[boot] exports enumerated');
function hookJni(exportName) {
    var addr = _exps[exportName] || null;
    if (addr === null) { console.log('[boot] NOEXPORT ' + exportName); return; }
    Interceptor.attach(addr, {
        onEnter: function (args) {
            this.t0 = Date.now();
            console.log('[boot] ENTER ' + exportName);
        },
        onLeave: function (retval) {
            console.log('[boot] LEAVE ' + exportName + ' dt=' + (Date.now() - this.t0) + 'ms');
        }
    });
    console.log('[boot] hooked ' + exportName);
}
var offs = [0x6c2460, 0x6c3d88];
for (var j = 0; j < offs.length; j++) {
    (function (off) {
        var addr = mod.base.add(off);
        Interceptor.attach(addr, {
            onEnter: function () { console.log('[boot] PIN-SITE hit'); }
        });
        console.log('[boot] pin-watch placed');
    })(offs[j]);
}
var names = ['Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_InitializeInstance',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_StartGaGaOs',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_InitializeMainProcess',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_SetNativeInfoCommon',
 'Java_com_vphonegaga_titan_VPhoneGaGaLibHelper_ContinueStartEngine'];
for (var n = 0; n < names.length; n++) { hookJni(names[n]); }
console.log('[boot] observer ready');
