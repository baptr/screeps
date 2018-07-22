// roleUpgrader
// Game.spawns.Spawn1.spawnCreep(Array(6).fill(WORK).concat(Array(6).fill(CARRY), Array(12).fill(MOVE)), 'remoteUpgrader3', {memory: {role: 'relocater', subtype: '_W5N9', reloRoom: 'W5N9', reloNextRole: 'upgrader'}})
module.exports = {
    run: function(creep) {
        if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
            creep.say('🔄 harvest');
	    }
	    if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.filling = false;
	        creep.say('⚡ upgrade');
	    }

	    if(!creep.memory.filling) {
            switch(creep.upgradeController(creep.room.controller)) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                break;
            case OK:
                var delivery = creep.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER;
                creep.memory.delivered += Math.min(delivery, creep.carry.energy);
            }
        } else {
            var container = Game.getObjectById(creep.memory.container);
            // TODO(baptr): handle non-link containers...
            if(container && container.structureType == STRUCTURE_LINK) {
                if(container.energy == 0) {
                    var src = container.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter: (s) => {
                        return s.structureType == STRUCTURE_LINK && s.energy > 0
                    }});
                    if(src) { 
                        src.transferEnergy(container);
                        return;
                    }
                }
                if(container.energy > 0) { 
                    var ret = creep.withdraw(container, RESOURCE_ENERGY);
                    switch(ret) {
                    case OK:
                        break;
                    case ERR_NOT_IN_RANGE:
                        creep.moveTo(container);
                        return;
                    default:
                        console.log(`${name} failed to withdraw from ${container}: ${ret}`);
                    }
                }
            }
            var source = Game.getObjectById(creep.memory.source);
            if(!source) {
                source = creep.room.controller.pos.findClosestByPath(FIND_SOURCES);
                creep.memory.source = source.id;
            }
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
	}
};