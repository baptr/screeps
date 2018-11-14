const splay = require('util.splay');
// TODO(baptr): Test/assign targets per-room to avoid the ~3+ x fanout every tick.
// TODO(baptr): Or skew checks when not under attack

module.exports = {
TYPE: STRUCTURE_TOWER, // XXX use this, or just rely on the module name?
run: function(tower) {
    var t = tower.memory.target; // indicates attack recently if not now
    var target = Game.getObjectById(t);
    if(target) {
        var ret = tower.attack(target);
        if(ret == OK) return;
        if(ret == ERR_INVALID_TARGET) {
            target = null;
        };
    }
    if(!target && (t || splay.isTurn('tower', tower.id))) {
        var targets = tower.room.find(FIND_HOSTILE_CREEPS);
        var highValue = _.filter(targets, c => {
            var body = _.groupBy(c.body, 'type');
            if(body[ATTACK] || body[RANGED_ATTACK] || body[CLAIM]) return true;
            if(c.carry.energy > 100) return true;
            return false;
        });
        if(highValue.length) targets = highValue;
        target = tower.pos.findClosestByRange(targets);
        if(target) {
            tower.memory.target = target.id;
            return tower.attack(target);
        } else {
            delete tower.memory.target;
        }
        let friend = tower.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
        if(friend) {
            return tower.heal(friend);
        }
    }
    
    if(!splay.isTurn('tower', tower.id)) return;
    
    if(tower.energy > 700) { // Save up some for defense.
        var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => structure.hits / structure.hitsMax < 0.95
        });
        if(closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }
    }
}
};

Object.defineProperty(StructureTower.prototype, 'memory', {
   get: function() {
       if(this.id && !this.my) return undefined;
       if(!Memory.structures) Memory.structures = {}; // XXX struct or tower?
       return Memory.structures[this.id] = Memory.structures[this.id] || {};
   },
   set: function(value) {
       if(this.id && !this.my) {
           throw new Error("Could not set other player's tower memory");
       }
       if(!Memory.structures) Memory.structures = {};
       Memory.structures[this.id] = value;
   }
});