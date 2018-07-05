var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.say('🚧 build');
	    }

	    if(creep.memory.building) {
	        var targets = creep.room.find(FIND_CONSTRUCTION_SITES).sort((a, b) => b.progress-a.progress);
            if(targets.length) {
                if(creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                return false;
            }
	    }
	    else {
	        var container = Game.getObjectById(creep.memory.container);
            if(container && container.store[RESOURCE_ENERGY] > 500) {
                if(creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
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
            /*
	        if(!creep.memory.source) {
                var sources = creep.room.find(FIND_SOURCES);
                creep.memory.source = sources[0].id;
            }
            var source = Game.getObjectById(creep.memory.source);
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            */
	    }
	}
};

module.exports = roleBuilder;