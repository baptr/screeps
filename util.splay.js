// register objects by class and id
// XXX how are they unregistered/reaped?
// each object can call to check if it should act yet
// XXX is it worth reading memory to local at start of tick and write back at end?
module.exports = {
register: function(cls, id) {
    if(!Memory.splay) Memory.splay = {};
    if(!Memory.splay[cls]) Memory.splay[cls] = {};
    const pre = Memory.splay[cls][id];
    if(pre) return pre;
    // find the gap
    const used = _.values(Memory.splay[cls]);
    used.sort((a, b) => a - b);
    var next = 0;
    _.forEach(used, u => {
        if(next != u) {
            return false;
        }
        next++;
    });
    Memory.splay[cls][id] = next;
    return next;
},
isTurn: function(cls, id) {
    if(!Memory.splay) module.exports.register(cls, id);
    const reg = Memory.splay[cls];
    var lim = _.max(_.values(reg));
    var offset = reg[id];
    if(!offset) {
        console.log(`splay.isTurn(${cls}, ${id}): unregistered!`);
        offset = module.exports.register(cls, id);
        if(offset > lim) lim = offset;
    }
    return (Game.time % lim) == offset;
}
};