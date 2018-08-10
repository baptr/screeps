// TODO(baptr): Test/assign targets per-room to avoid the ~3+ x fanout every tick.
// TODO(baptr): Or skew checks when not under attack
module.exports = {
TYPE: STRUCTURE_TOWER,
run: function(tower) {
    var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if(closestHostile) {
        tower.attack(closestHostile);
    }
    
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