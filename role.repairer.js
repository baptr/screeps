module.exports = {
    run: function(creep) {
        // TODO(baptr): Energy is usually colleted by the main roles, so this
        // branch is basically dead code.
        if(creep.energyAvailable < creep.energyCapacity) {
            var container = Game.getObjectById(creep.memory.container);
            if(container) {
                if(creep.withdraw(container) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container);
                }
            } else {
                var source = Game.getObjectById(creep.memory.source);
                if(!source) {
                    source = creep.pos.findClosestByPath(FIND_SOURCES);
                    creep.memory.source = source.id;
                }
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source);
                }
            }
        } else {
            var target = Game.getObjectById(creep.memory.repairTarget);
            if(!target || target.hits == target.hitsMax) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: (s) => {
                    return s.hits < s.hitsMax;
                }})
                if(target) { creep.memory.repairTarget = target.id }
            }
            if(!target) { return false }
            if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
    }
};