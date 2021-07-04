const util = require('util.creep');
const pathing = require('util.pathing');
const BodyBuilder = require('util.bodybuilder');

const ROLE = 'storeUpgrader';
const CONTROLLER_UPGRADE_RANGE = 3;

function findSrc(room) {
    const opts = room.controller.pos.findInRange(FIND_STRUCTURES, CONTROLLER_UPGRADE_RANGE+1, {
        filter: s => {return s.store && s.store.energy > 0;}
    });
    if(!opts.length) return null;
    const pref =  _.sortBy(opts, [s => -s.store.energy])
    return pref[0];
}

module.exports = {
spawnCondition: function(room, numExisting=0) {
    const src = findSrc(room);
    return src && numExisting < Math.floor(src.store.energy/900) && numExisting < 3;
},
spawn: function(spawn, mem={}) {
    const room = spawn.room;
    const src = Game.getObjectById(mem.src) || findSrc(room);
    if(!src) {
        const sites = room.find(FIND_CONSTRUCTION_SITES, {
            filter: {structureType: STRUCTURE_STORAGE}
        });
        if(sites.length) {
            console.log(`${ROLE} awaiting spawn until ${room.name} storage is built`);
            return false;
        } else {
            // TODO(baptr): The container should be near the edge of upgrade
            // range, in the direction of the sources, with the maximal free
            // surface area for pickup.
            console.log(`TODO: Place ${ROLE} storage container in ${room.name}`);
            return false;
        }
    }
    
    var body = new BodyBuilder([WORK, CARRY, MOVE], room.energyAvailable);
    body.extend([WORK], limit=10);
    body.extend([MOVE], limit=8); // XXX worth it?
    
    // Not worth it at small WORK sizes, save up for a bigger body.
    if(body.count(WORK) < 3) return false;
    
    mem.role = ROLE;
    mem.cost = body.cost;
    mem.src = src.id;
    const name =  `${ROLE}-${room.name}-${Game.time}`;
    const ret = spawn.spawnCreep(body.sort([MOVE, WORK, CARRY]), name, {memory: mem});
    if(ret != OK) {
        console.log(`Failed to spawn ${name}: ${ret}`);
    }
    return ret;
},
run: function(creep) {
    let src = Game.getObjectById(creep.memory.src);
    const ctrl = creep.room.controller;
    if(!src || !ctrl.my) {
        console.log(`${creep.name} lost storage!!`);
        // TODO(baptr): Switch to a dropHarvester? They have similar bodies
        return false;
    }
    
    var ret = creep.upgradeController(ctrl);
    const delivery = creep.getActiveBodyparts(WORK)*UPGRADE_CONTROLLER_POWER;
    switch(ret) {
    case OK:
        creep.memory.delivered += delivery;
        break;
    case ERR_NOT_IN_RANGE:
        creep.moveTo(ctrl);
        return;
    case ERR_NOT_ENOUGH_ENERGY:
        // filling is below
        break;
    default:
        console.log(`${creep.name} unhandled upgrade ret: ${ret}`);
    }
    var link = Game.getObjectById(creep.memory.link);
    if(!link && !creep.memory.hasOwnProperty('link')) {
        if(creep.room.memory.links) {
            link = Game.getObjectById(creep.room.memory.links.controller);
            creep.moveTo(link);
        } else {
            link = {};
        }
        creep.memory.link = link.id;
    }
    if(link) {
        if(!creep.pos.isNearTo(link)) {
            creep.moveTo(link);
        } else if(link.energy > 0) {
            // TODO(baptr): Empty the link greedily, dump into the storage.
            // Each creep call checks it can be satisfied with the *initial* energy, but actually runs
            // with the cumulative energy:
            // transfer -> withdraw -> upgrade
            // Unless we can write intents directly, this limits us to transfering "everything", withdrawing
            // the empty space we started with, and upgrading with what we withdrew.
            const mv = Math.min(creep.carryCapacity/2, link.energy);
            let transferRet = creep.transfer(src, RESOURCE_ENERGY, mv-delivery);
            let drawRet = creep.withdraw(link, RESOURCE_ENERGY, mv);
            // console.log(`${creep.name} had ${creep.carry.energy} energy, ${delivery} delivery. ${mv} mv. upgradeRet: ${ret} drawRet: ${drawRet} transferRet: ${transferRet}`);
            return;
        }
    }
    if(src && src.store.energy == 0) {
      src = findSrc(creep.room);
      if(src) {
        creep.memory.src = src.id;
      } else {
        return;
      }
    }
    // CPU_CLEANUP: Only grab every CARRY*50/WORK ticks.
    ret = creep.withdraw(src, RESOURCE_ENERGY, delivery);
    switch(ret) {
    case OK:
        break;
    case ERR_NOT_IN_RANGE:
        // TODO(baptr): Should be more careful about positioning at the start
        // so this can't happen.
        creep.moveTo(src);
        return
    case ERR_NOT_ENOUGH_RESOURCES:
        creep.withdraw(src, RESOURCE_ENERGY);
        break;
    }
},
ROLE,
};
