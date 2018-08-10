const util = require('util.creep');

const MIN_BODY = [WORK, CARRY, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

module.exports = {
mkBody: function(energyAvailable) {
    if(energyAvailable < MIN_COST) return false;
    
    var body = MIN_BODY.slice();
    var cost = MIN_COST;
    
    const extend = function(parts, limit=0) {
        let c = util.bodyCost(parts);
        let i = 0;
        while(cost + c <= energyAvailable && body.length + parts.length <= MAX_CREEP_SIZE) {
            body.push(...parts);
            cost += c;
            i++;
            if(limit > 0 && i >= limit) {
                break;
            }
        }
    }
    
    extend([WORK, MOVE], limit=4); // up to 1/2 of a carry per tick, costing 750 eng
    extend([CARRY, MOVE], limit=9); // up to 10 CARRY (500 eng cap) @ 1750 total eng cost
    
    extend([WORK, MOVE], limit=5); // build a full 50 eng/tick
    extend([CARRY, MOVE]);
    // max at 10 work, 15 carry, 25 move. 750 capacity, 15 tick build
    
    return body;
},
spawn: function(spawn) {
    const energyAvailable = spawn.room.energyAvailable;
    if(energyAvailable < MIN_COST || spawn.spawning) { return false; }
    
    var body = module.exports.mkBody(energyAvailable);
    
    var ret = spawn.spawnCreep(body, `builder-${spawn.room.name}-${Game.time}`, {
        memory: {role: 'builder'},
    });
    if(ret != OK) {
        console.log(`Failed to spawn builder (${body}): ${ret}`);
    }
    return ret;
},
    run: function(creep) {
	    if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
            delete creep.memory.source;
            delete creep.memory.container;
	    } else if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.filling = false;
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
	            creep.moveTo(target);
	            break;
	        case OK:
	            var delivery = creep.getActiveBodyparts(WORK)*BUILD_POWER;
	            creep.memory.delivered += Math.min(delivery, target.progressTotal-target.progress);
	            break;
	        }
	    } else {
	        var container = Game.getObjectById(creep.memory.container);
	        if(!container || container.structureType != STRUCTURE_CONTAINER || container.store.energy < 500) {
	            container = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: s => {
                        return s.structureType == STRUCTURE_CONTAINER && s.store.energy > 500;
                    }});
                if(container) {
                    creep.memory.container = container.id;
                    creep.moveTo(container);
                }
	        }
            if(container) {
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
                    if(creep.moveTo(source) == ERR_NO_PATH) {
                        delete creep.memory.source; // TODO(baptr): Count a few times first?
                    }
                }
            }
	    }
	}
};