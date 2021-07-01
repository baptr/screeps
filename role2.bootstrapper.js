const util = require('util.creep');
const resources = require('util.resources');
const BodyBuilder = require('util.bodybuilder');

/* TODOs
  - Upgrades at level 8 are limited to 15 energy/tick, so too many bootstrappers
    end up being useless.
  - Avoid blocking the path (especially at the controller)
*/

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
module.exports = {
ROLE,
spawnCondition: function(room, numBoots) {
    const energyCap = room.energyCapacityAvailable;
    const energyAvail = room.energyAvailable;
    const numSources = room.find(FIND_SOURCES).length;
    const spareEnergy = _.sum(room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_CONTAINER}}), s => s.store[RESOURCE_ENERGY])

    // Hardcoded 6/4/2 was too much for a single-source room.
    // TODO(baptr): Scale down when first starting and getting assistance from another room.
    if(numBoots >= numSources*4) { return false }
    
    // TODO(baptr): Tune limit before leaving more room for other types.
    if(energyCap > 1000 && numBoots >= numSources*2 && spareEnergy < numSources*3000) {
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

    builder.extend([WORK, MOVE], limit=1);
    builder.extend([WORK, CARRY, MOVE, MOVE], limit=2);
    builder.extend([CARRY, MOVE], limit=3)
    builder.extend([WORK, MOVE], limit=2);
    builder.extend([CARRY, MOVE]);
    
    builder.sort();
    
    extMem.role = ROLE;
    extMem.cost = builder.cost;
    extMem.life = {};
    const name = `${ROLE}-${spawn.room.name}-${Game.time}`;
    var ret = spawn.spawnCreep(builder.body, name, {memory: extMem});
    if(ret != OK) {
        console.log(`Spawn ${name} ret: ${ret}`);
    }
    return ret;
},
// - Deliver for spawning, then build extensions only, then upgrade
run: function(creep) {
    util.track(creep, 'alive');
    if(creep.carry.energy == creep.carryCapacity) creep.memory.filling = false;
    if(creep.carry.energy == 0) {
        delete creep.memory.src;
        creep.memory.filling = true;
    }
    
    // if(util.renew(creep)) return;
    
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
            util.track(creep, 'pickup', ret);
            pickupPower = src.amount;
        } else if(src.store) {
            ret = creep.withdraw(src, RESOURCE_ENERGY);
            util.track(creep, 'withdraw', ret);
            pickupPower = src.store.energy;
        } else {
            ret = creep.harvest(src);
            util.track(creep, 'harvest', ret);
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
            let moveRet = creep.moveTo(src, {reusePath: creep.memory.stuck ? 1 : 20});
            util.track(creep, 'move', moveRet);
            trace(creep, `attempted to moveTo(src ${src}): ${moveRet}. stuck: ${creep.memory.stuck}`);
            if(moveRet == ERR_NO_PATH) {
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
                if(Game.time % 10 == 0) console.log(creep.name, "has no dest :(");
                return false;
            }
            creep.memory.dest = dest.id;
            creep.memory.stuck = 0;
        }
        
        var effort;
        var ret;
        if(dest instanceof ConstructionSite) {
            ret = creep.build(dest);
            util.track(creep, 'build', ret);
            trace(creep, `build ${dest} ret: ${ret}`);
            effort = creep.getActiveBodyparts(WORK)*BUILD_POWER;
        } else {
            switch(dest.structureType) {
            case STRUCTURE_SPAWN:
            case STRUCTURE_EXTENSION:
            case STRUCTURE_TOWER:
                ret = creep.transfer(dest, RESOURCE_ENERGY);
                util.track(creep, 'transfer', ret);
                trace(creep, `transfer ${dest} ret: ${ret}`);
                effort = Math.min(creep.carry.energy, dest.energyCapacity-dest.energy);
                break;
            case STRUCTURE_CONTROLLER:
                // TODO(baptr): Consider dropping some energy instead of sitting
                // around upgrading when storeUpgraders are around.
                //if(creep.room.storage)
                ret = creep.upgradeController(dest);
                util.track(creep, 'upgrade', ret);
                trace(creep, `upgrade ${dest} ret: ${ret}`);
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
            let moveRet = creep.moveTo(dest, {reusePath: creep.memory.stuck ? 1 : 10});
            util.track(creep, 'move', moveRet);
            trace(creep, `attempted to moveTo(dst ${dest}): ${moveRet}. stuck: ${creep.memory.stuck}`);
            if(moveRet == ERR_NO_PATH) {
                creep.memory.stuck++;
                if(creep.memory.stuck > 5) {
                    console.log(`${creep.name} unable to reach ${dest}, respinning`);
                    delete creep.memory.dest;
                    findSrc(creep);
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
    
    // Res first, since they rot.
    // Leave tombs to haulers, or deal with them when they become resources.
    // Prefer containers, even if they're further.
    // But if there's nothing, grab (~back) from storage.
    // If it's really early days, try to harvest a source.
    
    src = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        // TODO(baptr): Figure out a better way to not wait around for
        // a dropHarvester's pile to get big enough.
        filter: r => r.resourceType == RESOURCE_ENERGY && r.amount > creep.pos.getRangeTo(r)*10
    });
    if(src) return done(src);
    
    src = creep.pos.findClosestByPath(FIND_RUINS, {filter: s => s.store.energy > 0});
    if(src) return done(src);
    
    // XXX only pick up from a container near the controller if you're going to upgrade
    src = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter:
        s => {
            if(s.structureType != STRUCTURE_CONTAINER) return false;
            if(!s.store.energy) return false;
            const ctrl = creep.room.controller;
            if(ctrl && ctrl.my && creep.memory.dest != ctrl.id) {
             if(s.pos.inRangeTo(ctrl, 4)) return false;
            }
            return true;
        }
    });
    if(src && src.store.energy < 100) {
        // See if there's a source near by we can help harvest.
        opt = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if(opt && creep.pos.getRangeTo(opt) < 5 && opt.energy > 100) {
            src = opt;
        }
    }
    if(src) return done(src);
    
    src = creep.room.storage;
    if(src && src.store.energy > 0) {
        return done(src);
    }
    
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
    
    // If this is a new room, make sure we get a spawn cooking.
    if(ctrl && ctrl.my && creep.room.find(FIND_MY_SPAWNS).length == 0) {
        const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {filter: s => {
            return BUILD_STRUCTS.includes(s.structureType);
        }})
        if(sites.length) return sites.shift();
    }
    
    // Do easy upgrades.
    if(ctrl && ctrl.my && ctrl.progress + 200 >= ctrl.progressTotal) {
        return ctrl;
    }
    
    var dest;
    // If we're under attack, keep towers supplied.
    // TODO(baptr): Load leveling
    if(creep.room.find(FIND_HOSTILE_CREEPS).length) {
        dest = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: s => {
            return s.isActive && s.structureType == STRUCTURE_TOWER && s.energy < 750;
        }});
        if(dest) return dest;
    }
    
    // Supply spawning structures.
    dest = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: s => {
        if(!s.isActive) return false;
        switch(s.structureType) {
        case STRUCTURE_SPAWN:
        case STRUCTURE_EXTENSION:
            return s.energy < s.energyCapacity;
        }
        return false;
    }});
    if(dest) { return dest; }
    
    dest = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: s => {
        return s.isActive && s.structureType == STRUCTURE_TOWER && s.energy < 500
    }})
    if(dest) return dest;
    
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