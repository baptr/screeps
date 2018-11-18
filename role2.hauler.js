const BodyBuilder = require('util.bodybuilder');

const ROLE = 'hauler';
module.exports = {
spawnCondition: function(room, existing=0) {
    const conts = room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_CONTAINER}});
    const storedEng = _.sum(_.map(conts, s => s.store.energy));
    return storedEng > 1000 && !existing;
},
spawn: function(spawn) {
    const room = spawn.room;
    if(!room.storage) return false;
    var body = new BodyBuilder([], room.energyAvailable);
    body.extend([CARRY, MOVE]);
    
    // Not worth it. Save up
    if(body.count(CARRY) < 10) return;
    
    // TODO(baptr): Allow some specialization?
    var mem = {role: ROLE, cost: body.cost};
    const name = `${ROLE}-${room.name}-${Game.time}`;
    const ret = spawn.spawnCreep(body.body, name, {memory: mem});
    if(ret != OK) {
        console.log(`Failed to spawn ${name}: ${ret}`);
    }
    return ret;
},
spawnRemote: function(spawn, remoteRoom, destRoom=null) {
    var storage = spawn.room.storage;
    if(destRoom) {
        storage = Game.rooms[destRoom].storage;
    }
    if(!storage) return ERR_RCL_NOT_ENOUGH;
    var body = new BodyBuilder([], spawn.room.energyAvailable);
    body.extend([CARRY, CARRY, MOVE]);
    
    if(body.count(CARRY) < 10) return ERR_NOT_ENOUGH_ENERGY;
    
    var mem = {
        role: ROLE,
        remoteRoom,
        dest: storage.id,
        cost: body.cost,
    }
    const name = `${ROLE}-${storage.room.name}-${remoteRoom}-${Game.time}`;
    const ret = spawn.spawnCreep(body.body, name, {memory: mem});
    if(ret != OK ){
        console.log(`Failed to spawn ${name}: ${ret}`);
    }
    return ret;
},
// TODO(baptr): In controlled rooms, leave some dropHarvested energy near the
// source for other types.
run: function(creep) {
    if(!_.sum(creep.carry)) creep.memory.filling = true;

    if(creep.memory.filling) {
        var src = findSrc(creep);
        // TODO(baptr): If there's already enough energy onboard, or lifetime is
        // low, deliver it anyway.
        if(!src) {
            // If there's no where else to draw from, take it home.
            if(creep.carry.energy) creep.memory.filling = false;
            return false;
        }
        if(!creep.pos.inRangeTo(src, 1)) {
            creep.moveTo(src);
            return
        }
        let ret;
        if(src instanceof Resource) {
            ret = creep.pickup(src);
        } else {
            ret = ERR_NOT_ENOUGH_RESOURCES;
            _.forEach(src.store, (v, t) => {
                if(v > 0) {
                    ret = creep.withdraw(src, t);
                    return false;
                }
            })
        }
        switch(ret) {
        case OK:
            // Either we're full and about to deliver, or it's empty and
            // we'll find a better one next.
            // TODO(baptr): Not ideal for withdrawing multiple things from a
            // tombstone.
            delete creep.memory.src;
            return;
        case ERR_FULL:
            creep.memory.filling = false;
            // fall through to the deliver block
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            // TODO(baptr): Deleting now means we won't be very patient if
            // we're waiting for a dropHarvester to fill up...
            delete creep.memory.src;
            return;
        default:
            console.log(`${creep.name} pickup from ${src} ret: ${ret}`);
            return;
        }
    }
    
    var dest = findDest(creep);
    if(!dest) return false;
    if(!creep.pos.inRangeTo(dest.pos, 1)) {
        creep.moveTo(dest);
        return
    }
    let ret = ERR_NOT_ENOUGH_RESOURCES;
    var resType;
    _.forEach(creep.carry, (v, t) => {
        if(v > 0) {
            resType = t;
            ret = creep.transfer(dest, t);
            return false;
        }
    })
    switch(ret) {
    case OK:
        // Hard to be accurate, so let's just be quick.
        creep.memory.delivered += creep.carry[resType];
        // XXX set filling? if we have anything left, the delivery was a lie,
        // and we'll just hit FULL next time anyway... probably?
        break;
    case ERR_FULL:
        // XXX wait? look for nearby creeps with capacity?
        if(creep.carry[resType] < creep.carryCapacity * 0.10) {
            creep.memory.filling = true;
            return;
        }
    case ERR_NOT_ENOUGH_RESOURCES:
        creep.memory.filling = true;
        break;
    default:
        console.log(`${creep.name} transfer to ${dest} ret: ${ret}`);
    }
},
ROLE,
resNear,
};

/*
First: energy
from: ground, dropHarvest containers, tombstones
to: spawn buildings, towers, upgrade storage
maybe directly to currently engaged workers???
*/
function findSrc(creep) {
    // TODO(baptr): What about fixed source areas instead of exact objects?
    var src = Game.getObjectById(creep.memory.src);
    if(src) {
        // Make sure there's still something to draw from.
        // TODO(baptr): Move towards something even if not...
        var avail = 0;
        if(src instanceof Resource) {
            avail = src.amount;
        } else if(src instanceof Source) {
            avail = src.energy;
        } else {
            avail = _.sum(src.store) || 0;
        }
        // TODO(baptr): We don't really want to go to a small store if we're far
        // away, but we do want to keep drawing from it if it's almost empty...
        if(avail > 0) {
            return src;
        }
    }
    if(creep.memory.remoteRoom) {
        const remoteRoom = creep.memory.remoteRoom;
        if(creep.pos.roomName != remoteRoom) {
            // TODO check visibilty and try picking a source anyway.
            creep.moveTo(new RoomPosition(25, 25, remoteRoom));
            return null;
        }
    }
    var ground = creep.room.find(FIND_DROPPED_RESOURCES);
    ground.push(...creep.room.find(FIND_TOMBSTONES, {filter: t => _.sum(t.store) > 0}));
    var res = creep.pos.findClosestByPath(ground);
    if(res) {
        creep.memory.src = res.id;
        return res;
    }
    var cont = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => {
            return s.structureType == STRUCTURE_CONTAINER &&
                // Quick hack to try to leave some behind for other uses.
                s.store.energy > 200;
        }});
    if(cont) {
        creep.memory.src = cont.id;
        return cont;
    }
    
    // TODO(baptr): Wait out of the way near (but not blocking) Sources.
    return src;
}

function findDest(creep) {
    var dest = Game.getObjectById(creep.memory.dest);
    if(dest) {
        // TODO(baptr): Check space? or do we want to travel anyway assuming
        // there will be space when we get there?
        return dest;
    }
    // XXX this won't work for remote haulers!
    dest = creep.room.storage;
    if(dest && dest.my) {
        creep.memory.dest = dest.id;
        return dest;
    }
    console.log(`TODO ${creep.name} has no dest!!`);
    return null;
}

function resNear(src, type=RESOURCE_ENERGY) {
    var conts = src.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: {structureType: STRUCTURE_CONTAINER}
    });
    return _.sum(_.map(conts, s => s.store[type]||0));
}