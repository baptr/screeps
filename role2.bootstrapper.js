/* Profiling stats 2018-08-10
7118		1050.3		0.148		Creep.getActiveBodyparts ** before removing
Avg: 17.73	Total: 8865.23	Ticks: 500

without the activeBodypart harvest check:
calls		time		avg		    function
11097		3382.5		0.305		role.bootstrapper.run
3463		1109.2		0.320		Creep.moveTo
4837		877.9		0.181		Creep.upgradeController
3381		709.6		0.210		Creep.move
2629		581.8		0.221		Creep.moveByPath
3147		477.4		0.152		Creep.withdraw
4026		392.3		0.097		RoomPosition.findClosestByPath
759	    	211.0		0.278		RoomPosition.findPathTo
759		    199.4		0.263		Room.findPath
939		    132.6		0.141		Creep.harvest
4026		93.8		0.023		Room.find
956		    59.4		0.062		Creep.transfer
5793		39.6		0.007		Creep.getActiveBodyparts
7770		35.6		0.005		RoomPosition.isNearTo
3313		18.4		0.006		RoomPosition.isEqualTo
4782		16.7		0.003		RoomPosition.inRangeTo
117	    	6.0		    0.051		Creep.pickup
22		    0.1		    0.004		Game.getObjectById
Avg: 16.74	Total: 8368.81	Ticks: 500

with reusePath=10
calls		time		avg		function
10375		3267.6		0.315		role.bootstrapper.run
4272		1294.7		0.303		Creep.moveTo
4153		869.3		0.209		Creep.move
3363		740.5		0.220		Creep.moveByPath
3750		599.9		0.160		Creep.upgradeController
4790		523.3		0.109		RoomPosition.findClosestByPath
2516		308.6		0.123		Creep.withdraw
808	    	200.9		0.249		RoomPosition.findPathTo
808	    	189.5		0.235		Room.findPath
1190		149.3		0.125		Creep.harvest
4790		115.3		0.024		Room.find
1404		84.0		0.060		Creep.transfer
11767		38.4		0.003		RoomPosition.isNearTo
7116		28.5		0.004		RoomPosition.isEqualTo
3750		22.4		0.006		Creep.getActiveBodyparts
240	    	14.0		0.058		Creep.pickup
3702		13.2		0.004		RoomPosition.inRangeTo
Avg: 16.01	Total: 8004.74	Ticks: 500
*/

var util = require('util.creep');

const DEBUG = false;

/* TODOs
  - Upgrades at level 8 are limited to 15 energy/tick, so too many bootstrappers
    end up being useless.
  - Smarter way to keep the controller afloat? (Ticks < 2k works for now...)
  - Avoid blocking the path (especially at the controller)
*/

const MIN_BODY = [WORK, CARRY, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

const BUILD_STRUCTS = [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    // TODO(baptr): Leave these for regular builders?
    STRUCTURE_TOWER,
    STRUCTURE_CONTAINER,
    STRUCTURE_ROAD,
    STRUCTURE_EXTRACTOR,
];

// "Balanced" type (role.bootstrap):
// - ((WORK, CARRY, MOVE) + MOVE) * N
// - Spawned until there are 2x (harvester + carrier)
module.exports = {
spawnCondition: function(spawn, roomKinds) {
    const energyCap = spawn.room.energyCapacityAvailable;
    const energyAvail = spawn.room.energyAvailable;
    const numSources = spawn.room.find(FIND_SOURCES).length;
    const numRole = r => (roomKinds[r] || []).length;
    const numBoots = numRole('bootstrapper');
    // Hardcoded 6/4/2 was too much for a single-source room.
    // TODO(baptr): Scale down when first starting and getting assistance from another room.
    if(numBoots >= numSources*3.5) { return false }
    // TODO(baptr): Tune limit before leaving more room for other types.
    if(energyCap > 1000 && numBoots >= numSources*2) {
        return false;
    }
    if(numBoots >= numSources && energyAvail < 0.9*energyCap) {
        return false;
    }
    if(DEBUG && !spawn.spawning) {
        console.log(`OK to spawn bootstrapper in ${spawn.room.name}. ${numBoots} vs ${numSources}. ${energyAvail} < ${energyCap}`);
    }
    return true;
},
spawn: function(spawn, extMem={}) {
    const energyAvailable = spawn.room.energyAvailable;
    if(energyAvailable < MIN_COST || spawn.spawning) { return false; }
    
    var body = MIN_BODY.slice();
    var cost = MIN_COST;
    
    var extend = function(parts, limit=0) {
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
    
    extend([MOVE], limit=1);
    extend([WORK, CARRY, MOVE, MOVE]);
    extend([WORK, MOVE], limit=1);
    extend([CARRY, MOVE])
    //extend([CARRY]) // TODO(baptr): worth it?
    
    extMem.role = 'bootstrapper';
    var ret = spawn.spawnCreep(body, 'bootstrapper-'+spawn.room.name+'-'+Game.time, {
        memory: extMem,
    });
    if(ret != OK) {
        console.log('Spawn attempt for bootstrapper: '+body+' : ' + ret);
    }
    return ret;
},
// - Deliver for spawning, then build extensions only, then upgrade
run: function(creep) {
    if(creep.memory.filling) {
        var src = Game.getObjectById(creep.memory.src); // TODO(baptr): Figure out when to unlatch.
        if(!src) {
            src = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                // TODO(baptr): Figure out a better way to not wait around for
                // a dropHarvester's pile to get big enough.
                filter: r => r.resourceType == RESOURCE_ENERGY && r.amount > 50
            });
            if(!src) {
                src = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter:
                    s => s.structureType == STRUCTURE_CONTAINER && s.store.energy > 50
                });
            }
            if(!src) {
                src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            }
            if(!src) { return false; }
            creep.memory.src = src.id;
        }
        var ret;
        if(src instanceof Resource) {
            ret = creep.pickup(src);
        } else if(src instanceof StructureContainer) {
            ret = creep.withdraw(src, RESOURCE_ENERGY);
        } else {
            ret = creep.harvest(src);
        }
        switch(ret) {
        case ERR_FULL:
            creep.memory.filling = false;
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            // creep.memory.filling = false;
            delete creep.memory.src;
            break;
        case ERR_NOT_IN_RANGE:
            if(creep.moveTo(src, {reusePath: 10}) == ERR_NO_PATH) {
                delete creep.memory.src;
            }
            break;
        case OK:
            // XXX this is rather expensive...
            //if(creep.carry.energy + creep.getActiveBodyparts(WORK)*HARVEST_POWER >= creep.carryCapacity) {
            if(creep.carry.energy == creep.carryCapacity) {
                creep.memory.filling = false;
                break;
            }
        }
        if(!creep.memory.filling) {
            // TODO(baptr): feels a little weird to re-prioritize every fill,
            // but without it, they'd continue to BUILD even when delivery
            // was needed.
            // Is this too often?
            delete creep.memory.dest;
        }
    } else {
        var dest = Game.getObjectById(creep.memory.dest);
        if(!dest) {
            dest = findDest(creep);
            if(!dest) { return false; }
            creep.memory.dest = dest.id;
        }
        
        var effort;
        var ret;
        if(dest instanceof ConstructionSite) {
            ret = creep.build(dest);
            effort = creep.getActiveBodyparts(WORK)*BUILD_POWER;
        } else {
            switch(dest.structureType) {
            case STRUCTURE_SPAWN:
            case STRUCTURE_EXTENSION:
            case STRUCTURE_TOWER:
                ret = creep.transfer(dest, RESOURCE_ENERGY);
                effort = Math.min(creep.carry.energy, dest.energyCapacity-dest.energy);
                break;
            case STRUCTURE_CONTROLLER:
                ret = creep.upgradeController(dest);
                effort = creep.getActiveBodyparts(WORK)*UPGRADE_CONTROLLER_POWER;
                break;
            default:
                console.log(`${creep.name} unrecognized dest type ${dest.structureType}: ${dest}`);
                delete creep.memory.dest;
                return false;
            }
        }
        
        switch(ret) {
        case ERR_NOT_IN_RANGE:
            if(creep.moveTo(dest, {reusePath: 10}) == ERR_NO_PATH) {
                delete creep.memory.dest; // retry a few times?
            }
            break;
        case ERR_FULL:
            delete creep.memory.dest;
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.memory.filling = true;
            // XXX best time?
            delete creep.memory.src;
            break;
        case ERR_INVALID_TARGET:
            delete creep.memory.dest;
            break;
        case ERR_BUSY: // Not spawned yet.
            break;
        case OK:
            creep.memory.delivered += effort;
            break;
        case ERR_RCL_NOT_ENOUGH:
            // Since we're not prioritizing upgrades, if the controller drops
            // below the level to support the extensions we've already scheduled,
            // we could ~deadlock.
            creep.memory.dest = creep.room.controller.id;
            break;
        default:
            console.log(`Unrecognized delivery error to ${dest}: ${ret}`);
        }
    }
}
};

function findDest(creep) {
    // Spawning structures.
    var dest = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: s => {
        switch(s.structureType) {
        case STRUCTURE_SPAWN:
        case STRUCTURE_EXTENSION:
            return s.energy < s.energyCapacity;
        case STRUCTURE_TOWER:
            // TOOD(baptr): factor out the attack/repair const
            return s.energy < 500;
        }
        return false;
    }});
    if(dest) { return dest; }
    
    var ctrl = creep.room.controller;
    if(ctrl && ctrl.my && ctrl.ticksToDowngrade < CONTROLLER_DOWNGRADE[ctrl.level] * 0.9) {
        return ctrl;
    }
    
    // Spawning build sites.
    // Need priority buckets.
    dest = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {filter: s => {
        return BUILD_STRUCTS.includes(s.structureType);
    }})
    if(dest) { return dest; }
    
    // TODO(baptr): If the controller is already level 8, maybe count the number
    // of WORK bodies already near it and find something else to do?
    // (15/tick limit)
    if(ctrl && ctrl.my) {
        return ctrl;
    }
    return null;
}