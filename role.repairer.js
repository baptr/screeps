module.exports = {
    run: function(creep) {
        // TODO(baptr): Energy is usually collected by the main roles, so this
        // branch is basically dead code.
        if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
        } else if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
            creep.memory.filling = false;
        }
        
        if(creep.memory.filling) {
            var container = Game.getObjectById(creep.memory.container);
            if(container && container.store[RESOURCE_ENERGY] > 500) {
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
            // TODO(baptr): Would be nice to give some priority to low-hit structures
            var target = Game.getObjectById(creep.memory.repairTarget);
            if(!target || target.hits == target.hitsMax) {
                var structs = creep.room.find(FIND_STRUCTURES, {filter: 
                    (s) => s.hits < s.hitsMax
                }).sort((a, b) => a.hits - b.hits);
                target = structs[0];
                /*target = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: (s) => {
                    return s.hits < s.hitsMax;
                }})*/
                if(!target) {
                    return false;
                }
                creep.memory.repairTarget = target.id;
            }
            if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
    }
};