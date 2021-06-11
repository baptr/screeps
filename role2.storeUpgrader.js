const util = require('util.creep');
const pathing = require('util.pathing');
const BodyBuilder = require('util.bodybuilder');

const ROLE = 'storeUpgrader';
const CONTROLLER_UPGRADE_RANGE = 3;

module.exports = {
spawnCondition: function(room, numExisting=0) {
    return room.storage && numExisting < Math.floor(room.storage.store.energy/4000);
},
spawn: function(spawn, mem={}) {
    const room = spawn.room;
    var store = Game.getObjectById(mem.src) || room.storage;
    if(!store) {
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
    
    // Sanity check that store is in range to ctrl
    if(!store.pos.inRangeTo(room.controller, CONTROLLER_UPGRADE_RANGE+1)) {
        console.log(`${ROLE}: ${room.name} controller too far from storage`);
        return false;
    }
    
    var body = new BodyBuilder([WORK, CARRY, MOVE], room.energyAvailable);
    body.extend([WORK, WORK, MOVE], limit=7);
    body.extend([MOVE], limit=8); // XXX worth it?
    
    // Not worth it at small WORK sizes, save up for a bigger body.
    if(body.count(WORK) < 3) return false;
    
    mem.role = ROLE;
    mem.cost = body.cost;
    const name =  `${ROLE}-${room.name}-${Game.time}`;
    const ret = spawn.spawnCreep(body.sort([MOVE, WORK, CARRY]), name, {memory: mem});
    if(ret != OK) {
        console.log(`Failed to spawn ${name}: ${ret}`);
    }
    return ret;
},
run: function(creep) {
    var store = creep.room.storage;
    if(!store && creep.memory.src) {
        store = Game.getObjectById(creep.memory.src);
    }
    const ctrl = creep.room.controller;
    if(!store || !ctrl.my) {
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
        let mvRet = creep.moveTo(ctrl);
        console.log(`${creep.name} moving to ${ctrl}: ${mvRet}`);
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
            let transferRet = creep.transfer(store, RESOURCE_ENERGY, mv-delivery);
            let drawRet = creep.withdraw(link, RESOURCE_ENERGY, mv);
            // console.log(`${creep.name} had ${creep.carry.energy} energy, ${delivery} delivery. ${mv} mv. upgradeRet: ${ret} drawRet: ${drawRet} transferRet: ${transferRet}`);
            return;
        }
    }
    // CPU_CLEANUP: Only grab every CARRY*50/WORK ticks.
    ret = creep.withdraw(store, RESOURCE_ENERGY, delivery);
    switch(ret) {
    case OK:
        break;
    case ERR_NOT_IN_RANGE:
        // TODO(baptr): Should be more careful about positioning at the start
        // so this can't happen.
        creep.moveTo(store);
        return
    case ERR_NOT_ENOUGH_RESOURCES:
        creep.withdraw(store, RESOURCE_ENERGY);
        break;
    }
},
ROLE,
};