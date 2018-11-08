const util = require('util.creep');
const resources = require('util.resources');
const BodyBuilder = require('util.bodybuilder');

const DEBUG = false;

/* TODOs
  - Upgrades at level 8 are limited to 15 energy/tick, so too many bootstrappers
    end up being useless.
  - Smarter way to keep the controller afloat? (Ticks < 2k works for now...)
  - Avoid blocking the path (especially at the controller)
*/

// TODO(baptr): Worth spawning crippled ones early on? Double move is not much more...
const MIN_BODY = [WORK, CARRY, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);
const ROLE = 'bootstrapper';

const BUILD_STRUCTS = [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    // TODO(baptr): Leave these for regular builders?
    STRUCTURE_TOWER,
    STRUCTURE_CONTAINER,
    STRUCTURE_ROAD,
    STRUCTURE_EXTRACTOR,
];

function trace(creep, msg) {
    if(!creep.memory.trace) return;
    console.log(creep.name+": "+msg);
}

// "Balanced" type (role.bootstrap):
// - ((WORK, CARRY, MOVE) + MOVE) * N
// - Spawned until there are 2x (harvester + carrier)
module.exports = {
ROLE,
spawnCondition: function(room, numBoots) {
    const energyCap = room.energyCapacityAvailable;
    const energyAvail = room.energyAvailable;
    const numSources = room.find(FIND_SOURCES).length;
    // Hardcoded 6/4/2 was too much for a single-source room.
    // TODO(baptr): Scale down when first starting and getting assistance from another room.
    if(numBoots >= numSources*3) { return false }
    // TODO(baptr): Tune limit before leaving more room for other types.
    if(energyCap > 1000 && numBoots >= numSources*2) {
        return false;
    }
    if(numBoots >= numSources*1.5 && energyAvail < 0.9*energyCap) {
        return false;
    }
    if(numBoots >= numSources && energyAvail < 0.5*energyCap) {
        return false;
    }
    return true;
},
spawn: function(spawn, extMem={}) {
    const energyAvailable = spawn.room.energyAvailable;
    if(energyAvailable < MIN_COST || spawn.spawning) { return false; }
    
    var builder = new BodyBuilder(MIN_BODY, energyAvailable);
    
    // TOOD(baptr): Once we have dropHarvesters, CARRY heavy makes more sense
    // than balanced. But these are supposed to be balanced. So better set up
    // a second type...
    builder.extend([WORK, MOVE], limit=1);
    builder.extend([WORK, CARRY, MOVE, MOVE], limit=2);
    builder.extend([CARRY, MOVE], limit=3)
    builder.extend([WORK, MOVE], limit=2);
    builder.extend([CARRY, MOVE]);
    
    builder.sort();
    
    extMem.role = ROLE;
    extMem.cost = builder.cost;
    const name = `${ROLE}-${spawn.room.name}-${Game.time}`;
    var ret = spawn.spawnCreep(builder.body, name, {memory: extMem});
    if(ret != OK) {
        console.log(`Spawn ${name} ret: ${ret}`);
    }
    return ret;
},
// - Deliver for spawning, then build extensions only, then upgrade
run: function(creep) {
    if(creep.carry.energy == creep.carryCapacity) creep.memory.filling = false;
    if(creep.carry.energy == 0) creep.memory.filling = true;
    if(creep.memory.filling) {
        var src = findSrc(creep);
        if(!src) {
            if(creep.carry.energy > 50) {
                creep.memory.filling = false;
            }
            return false;
        }
        
        var ret;
        var pickupPower;
        if(src instanceof Resource) {
            ret = creep.pickup(src);
            pickupPower = src.amount;
        } else if(src.store) {
            ret = creep.withdraw(src, RESOURCE_ENERGY);
            pickupPower = src.store.energy;
        } else {
            ret = creep.harvest(src);
            pickupPower = creep.getActiveBodyparts(WORK)*HARVEST_POWER;
        }
        trace(creep, `gather ret: ${ret}`);
        switch(ret) {
        case ERR_FULL:
            console.log(`${creep.name} harvested while full`);
            creep.memory.filling = false;
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            delete creep.memory.src;
            break;
        case ERR_NOT_IN_RANGE:
            if(creep.moveTo(src, {reusePath: creep.memory.stuck ? 1 : 20}) == ERR_NO_PATH) {
                creep.memory.stuck++;
                if(creep.memory.stuck > 5) {
                    console.log(`${creep.name} unable to reach ${src}, respinning`);
                    delete creep.memory.src;
                }
            }
            break;
        case OK:
            if(creep.carry.energy+pickupPower >= creep.carryCapacity) {
                // Avoid latching too long.
                delete creep.memory.dest;
                creep.memory.filling = false;
            }
            break;
        }
    } else {
        var dest = Game.getObjectById(creep.memory.dest);
        if(!dest) {
            dest = findDest(creep);
            if(!dest) { 
                console.log(creep.name, " has nowhere to go :(");
                return false;
            }
            creep.memory.dest = dest.id;
            creep.memory.stuck = 0;
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
        trace(creep, `build ${dest} ret: ${ret}`);
        switch(ret) {
        case ERR_NOT_IN_RANGE:
            if(creep.moveTo(dest, {reusePath: 10}) == ERR_NO_PATH) {
                creep.memory.stuck++;
                if(creep.memory.stuck > 5) {
                    console.log(`${creep.name} unable to reach ${dest}, respinning`);
                    delete creep.memory.dest;
                }
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

function findSrc(creep) {
    var src = Game.getObjectById(creep.memory.src); // TODO(baptr): Figure out when to unlatch.
    trace(creep, `filling. held src: ${creep.memory.src} = ${src}`);
    if(src && resources.resAvail(src) > 0) {
        return src;
    }
    
    const done = function(src) {
        trace(creep, `new src: ${src} (${src.id})`);
        creep.memory.src = src.id;
        creep.memory.stuck = 0;
        return src;
    }
    
    src = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        // TODO(baptr): Figure out a better way to not wait around for
        // a dropHarvester's pile to get big enough.
        filter: r => r.resourceType == RESOURCE_ENERGY && r.amount > creep.pos.getRangeTo(r)*10
    });
    if(src) return done(src);
    
    src = creep.pos.findClosestByPath(FIND_TOMBSTONES, {filter:
        t => t.store.energy > 0
    });
    if(src) return done(src);
    
    src = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter:
        s => (s.structureType == STRUCTURE_CONTAINER || 
              s.structureType == STRUCTURE_STORAGE)
            && s.store.energy > 0
    });
    if(src) return done(src);

    // TODO(baptr): Look at all sources to move close while they're
    // respawning.
    src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if(src) return done(src);

    trace(creep, `unable to find src. existing energy ${creep.carry.energy}`);
    if(creep.carry.energy > 0) {
        creep.memory.filling = false;
    }
    return null;
}

function findDest(creep) {
    // Make sure we don't downgrade.
    var ctrl = creep.room.controller;
    if(ctrl && ctrl.my && ctrl.ticksToDowngrade < CONTROLLER_DOWNGRADE[ctrl.level] * 0.5) {
        return ctrl;
    }
    
    // Do easy upgrades.
    if(ctrl && ctrl.my && ctrl.progress + 200 >= ctrl.progressTotal) {
        return ctrl;
    }
    
    // Supply spawning structures.
    var dest = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: s => {
        if(!s.isActive) return false;
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
    
    // Try to keep it high.
    if(ctrl && ctrl.my && ctrl.ticksToDowngrade < CONTROLLER_DOWNGRADE[ctrl.level] * 0.9) {
        return ctrl;
    }
    
    // Spawning build sites.
    // Need priority buckets.
    const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {filter: s => {
        return BUILD_STRUCTS.includes(s.structureType);
    }})
    dest = creep.pos.findClosestByPath(sites, {filter: s => s.progress > 0});
    if(dest) { return dest; }
    dest = creep.pos.findClosestByPath(sites);
    if(dest) { return dest; }
    
    // TODO(baptr): If the controller is already level 8, maybe count the number
    // of WORK bodies already near it and find something else to do?
    // (15/tick limit)
    if(ctrl && ctrl.my) {
        return ctrl;
    }
    return null;
}