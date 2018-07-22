var util = require('util');

const MIN_BODY = [WORK, CARRY, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

// "Balanced" type (role.bootstrap):
// - ((WORK, CARRY, MOVE) + MOVE) * N
// - Spawned until there are 2x (harvester + carrier)
module.exports = {
spawnCondition: function(spawn, roomKinds) {
    const energyCap = spawn.room.energyCapacityAvailable;
    var numRole = r => (roomKinds[r] || []).length;
    const numBoots = numRole('bootstrapper');
    // TODO(baptr): Hardcoded 6/4/2 is too much for a single source room.
    if(numBoots >= 6) { return false }
    // TODO(baptr): Tune limit before leaving more room for other types.
    if(energyCap > 1000 && numBoots >= 4) {
        return false;
    }
    if(numBoots >= 2 && spawn.room.energyAvailable < 0.9*energyCap) {
        return false;
    }
    return true;
},
spawn: function(spawn) {
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
    
    var ret = spawn.spawnCreep(body, 'bootstrapper-'+spawn.room.name+'-'+Game.time, {
        memory: {role: 'bootstrapper'},
    });
    console.log('Spawn attempt for '+body+' : ' + ret);
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
                if(!src) {
                    src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                    if(!src) { return false; }
                }
            }
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
            if(creep.moveTo(src) == ERR_NO_PATH) {
                delete creep.memory.src;
            }
            break;
        case OK:
            if(creep.carry.energy + creep.getActiveBodyparts(WORK)*HARVEST_POWER >= creep.carryCapacity) {
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
        
        var ret;
        if(dest instanceof ConstructionSite) {
            ret = creep.build(dest);
        } else {
            switch(dest.structureType) {
            case STRUCTURE_SPAWN:
            case STRUCTURE_EXTENSION:
            case STRUCTURE_TOWER:
                ret = creep.transfer(dest, RESOURCE_ENERGY);
                break;
            case STRUCTURE_CONTROLLER:
                ret = creep.upgradeController(dest);
                break;
            default:
                console.log(`${creep.name} unrecognized dest type ${dest.structureType}: ${dest}`);
                delete creep.memory.dest;
                return false;
            }
        }
        
        switch(ret) {
        case ERR_NOT_IN_RANGE:
            if(creep.moveTo(dest) == ERR_NO_PATH) {
                delete creep.memory.dest; // retry a few times?
            }
            break;
        case ERR_FULL:
            delete creep.memory.dest;
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.memory.filling = true;
            break;
        case ERR_INVALID_TARGET:
            delete creep.memory.dest;
            break;
        case ERR_BUSY: // Not spawned yet.
            break;
        case OK:
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
    
    // Spawning build sites.
    // Need priority buckets.
    dest = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {filter: s => {
        switch(s.structureType) {
        case STRUCTURE_SPAWN:
        case STRUCTURE_EXTENSION:
        // TODO(baptr): Leave these for regular builders?
        case STRUCTURE_TOWER:
        case STRUCTURE_CONTAINER:
        case STRUCTURE_ROAD:
            return true
        }
        return false;
    }})
    if(dest) { return dest; }
    
    return creep.room.controller;
}