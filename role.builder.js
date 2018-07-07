module.exports = {
    run: function(creep) {
        if(creep.ticksToLive == 1) {
            console.log(creep.name + ' lifetime achievement: '+creep.memory.delivered);
        }
	    if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
            creep.say('🔄 harvest');
	    }
	    if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.filling = false;
	        creep.say('🚧 build');
	    }

	    if(!creep.memory.filling) {
	        var target = Game.getObjectById(creep.memory.buildTarget);
	        if(!target || target.progress == target.progressTotal) {
	            target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
	            if(!target) {
	                return false;
	            }
	            creep.memory.buildTarget = target.id;
	        }
	        //var targets = creep.room.find(FIND_CONSTRUCTION_SITES).sort((a, b) => b.progress-a.progress);
	        switch(creep.build(target)) {
	        case ERR_NOT_IN_RANGE:
	            creep.moveTo(target,  {visualizePathStyle: {stroke: '#ffffff'}});
	            break;
	        case OK:
	            var delivery = creep.getActiveBodyparts(WORK)*BUILD_POWER;
	            creep.memory.delivered += Math.min(delivery, target.progressTotal-target.progress);
	            break;
	        }
	    } else {
	        var container = Game.getObjectById(creep.memory.container);
            if(container && container.store[RESOURCE_ENERGY] > 500) {
                if(creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container);
                }
            } else {
                var source = Game.getObjectById(creep.memory.source);
                if(!source) {
                    source = creep.pos.findClosestByPath(FIND_SOURCES);
                    if(!source) { return; }
                    creep.memory.source = source.id;
                }
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source);
                }
            }
	    }
	}
};