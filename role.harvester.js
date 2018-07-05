function energyNeeded(struct) {
    return struct.energyCapacity-struct.energy;
}

var fillPriority = {
    extension: 10,
    spawn: 5,
    tower: 2,
    container: 1
};

function fillSort(a, b) {
    if(a.structureType != b.structureType) {
        return fillPriority[b.structureType] - fillPriority[a.structureType];
    }
    return energyNeeded(b) - energyNeeded(a);
}

var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
	    if(creep.carry.energy < creep.carryCapacity) {
	        if(!creep.memory.source) {
                var sources = creep.room.find(FIND_SOURCES);
                creep.memory.source = sources[0].id;
            }
            var source = Game.getObjectById(creep.memory.source);
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        else {
            var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType in fillPriority && energyNeeded(s) > 0;
                    }
            }).sort(fillSort);
            //console.log(_.map(targets, (t) => t.structureType));
            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                var closestDamagedStructure = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => structure.hits / structure.hitsMax < 0.99
                });
                if(closestDamagedStructure) {
                    if(creep.repair(closestDamagedStructure) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(closestDamagedStructure, {visualizePathStyle: {stroke: '#ff3355'}});
                    }
                }
            }
        }
	}
};

module.exports = roleHarvester;