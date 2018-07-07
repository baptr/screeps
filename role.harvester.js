function energyNeeded(struct) {
    return struct.energyCapacity-struct.energy;
}

var fillPriority = {
    extension: 1,
    spawn: 1,
    tower: 5,
    container: 10
};

function fillSort(a, b) {
    if(a.structureType != b.structureType) {
        return fillPriority[b.structureType] - fillPriority[a.structureType];
    }
    return energyNeeded(b) - energyNeeded(a);
}

// roleHarvester
module.exports = {
    run: function(creep) {
        if(creep.ticksToLive == 1) {
            console.log(creep.name + ' lifetime achievement: ' + creep.memory.delivered);
        }
        
        if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
            creep.say('Refill');
        } else if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
            creep.memory.filling = false;
            creep.say('Delivery');
            delete creep.memory.fillTarget;
        }
        
	    if(creep.memory.filling) {
            var source = Game.getObjectById(creep.memory.source);
            if(!source) { // TODO(baptr): Also reset if empty or blocked?
                source = creep.pos.findClosestByPath(FIND_SOURCES);
                if(!source) { 
                    creep.say('No source');
                    return false;
                }
                creep.memory.source = source.id;
            }
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        } else {
            var target = Game.getObjectById(creep.memory.fillTarget);
            // TODO(baptr): too latchy. Need to re-priority each trip, probably.
            if(!target || target.energy == target.energyCapacity) {
                var targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (s) => {
                            return s.structureType in fillPriority && energyNeeded(s) > 0;
                        }
                });
                var priorityBuckets = _.groupBy(targets, (s) => fillPriority[s.structureType]);
                // XXX ensure we're using the highest priority bucket
                for(bucket in priorityBuckets) {
                    target = creep.pos.findClosestByPath(priorityBuckets[bucket]);
                    if(target) {
                        break;
                    }
                }
                if(!target) { return false; }
                creep.memory.fillTarget = target.id;
            }
            switch(creep.transfer(target, RESOURCE_ENERGY)) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                break;
            case OK:
                creep.memory.delivered += Math.min(creep.carry.energy, energyNeeded(target));
            }
        }
	}
};