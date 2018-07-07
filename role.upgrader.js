// roleUpgrader
// Game.spawns.Spawn1.spawnCreep(Array(6).fill(WORK).concat(Array(6).fill(CARRY), Array(12).fill(MOVE)), 'remoteUpgrader3', {memory: {role: 'relocater', subtype: '_W5N9', reloRoom: 'W5N9', reloNextRole: 'upgrader'}})
module.exports = {
    run: function(creep, mem) {
        if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
            creep.say('🔄 harvest');
	    }
	    if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.filling = false;
	        creep.say('⚡ upgrade');
	    }

	    if(!creep.memory.filling) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        } else {
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