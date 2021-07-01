const BodyBuilder = require('util.bodybuilder');

const ROLE = 'remoteHarvester';
module.exports = {
ROLE,
spawn: function(spawn, srcRoom, destRoom) {
    if(!srcRoom) return ERR_INVALID_ARGS;
    if(!destRoom) destRoom = spawn.room.name;
    var dest;
    {
        let rm = Game.rooms[destRoom];
        if(!rm) return ERR_NOT_FOUND;
        if(!rm.storage) return ERR_RCL_NOT_ENOUGH;
        
        dest = rm.storage;
        
        let links = rm.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}});
        if(links) {
            // find closest to an exit towards srcRoom
            // TODO(baptr): Could be better if we knew where the source was.
            var exits = rm.find(Game.map.findExit(rm, srcRoom));
            
            // XXX walls, roads
            const searchOpts = {maxOps: 1000, maxCost: 100, maxRooms: 2}
            
            let storePath = PathFinder.search(dest.pos, exits, searchOpts);
            var destCost = storePath.cost;
            var destDistance = storePath.path.length;

            _.forEach(links, l => {
                let path = PathFinder.search(l.pos, exits, searchOpts);
                if(path.incomplete) return;
                if(path.cost < destCost) {
                    dest = l;
                    destCost = path.cost;
                    destDistance = path.path.length;
                }
            });
            console.log(`Chose dest ${dest} at ${destCost} cost (${destDistance} len)`);
        }
    }
    if(!dest) {
        console.log(`${ROLE}.spawn(${spawn}, ${srcRoom}, ${destRoom}): lost destination!!`);
        return ERR_INVALID_TARGET;
    }
    
    if(Game.rooms[srcRoom]) {
        console.log(`TODO: Could have calculated distance to source in ${srcRoom}`);
    }
    
    const builder = new BodyBuilder([], spawn.room.energyAvailable);
    builder.extend([CARRY, MOVE], limit=5);
    builder.extend([WORK, MOVE], limit=10);
    builder.extend([CARRY, MOVE]);
    
    if(builder.count(WORK) < 5 || builder.count(CARRY) < 5) {
        return ERR_NOT_ENOUGH_ENERGY;
    }
    
    const name = `${ROLE}-${srcRoom}-${destRoom}-${Game.time}`;
    const mem = {
        role: ROLE,
        cost: builder.cost,
        srcRoom,
        destRoom,
        origDest: dest.id,
        dest: dest.id
    };
    const body = builder.sort();
    return spawn.spawnCreep(body, name, {memory: mem});
},
run: function(creep) {
    if(creep.carry.energy == 0) {
        creep.memory.filling = true;
    } else if(creep.carry.energy == creep.carryCapacity) {
        creep.memory.filling = false;
    }
    
    if(creep.memory.filling) {
        fill(creep);
    } else {
        deliver(creep);
    }
}
};

function fill(creep) {
    var src = Game.getObjectById(creep.memory.src);
    if(!src) {
        var srcName = creep.memory.srcRoom;
        var srcRoom = Game.rooms[srcName];
        if(srcRoom) {
            var sources = srcRoom.find(FIND_SOURCES_ACTIVE);
            var dest = (Game.rooms[creep.memory.destRoom] || {}).storage;
            if(!dest) dest = creep;
            src = dest.pos.findClosestByPath(sources);
            if(!src) {
                if(Game.time % 5 == 0) console.log(`${creep.name} failed to find source in ${srcRoom}`);
                src = sources[0];
                if(!src) return ERR_NOT_FOUND;
            }
            creep.memory.src = src.id;
            creep.memory.srcPos = src.pos;
        } else {
            var srcPos = creep.memory.srcPos;
            if(srcPos) {
                srcPos = new RoomPosition(srcPos.x, srcPos.y, srcName);
            } else {
                srcPos = new RoomPosition(25, 25, srcName);
            }
            return creep.moveTo(srcPos);
        }
    }
    if(src.energy == 0) {
        if(creep.carry.energy > 100) {
            if(creep.memory.filling) {
                creep.memory.filling = false;
                return deliver(creep);
            }
            return OK;
        } else if(src.ticksToRegeneration > 50) {
            delete creep.memory.src;
            return; // tempting to return fill(creep), but feels a bit dangerous
        }
    }
    if(!creep.pos.isNearTo(src)) {
        return creep.moveTo(src);
    } else {
        // TODO is it worth the CPU to saving a tick per trip to check
        // carry+POWER >= capacity and leave the tick we do the final harvest?
        return creep.harvest(src);
    }
}

function deliver(creep) {
    var dest = Game.getObjectById(creep.memory.dest);
    if(!dest) {
        var destName = creep.memory.destRoom;
        var destRoom = Game.rooms[destName];
        if(!destRoom) {
            console.log(`${creep.name} lost visibility to ${destName}`);
            return ERR_NOT_FOUND;
        }
        dest = destRoom.storage;
        if(!dest) {
            console.log(`${creep.name} lost storage in ${destRoom}`);
            return ERR_RCL_NOT_ENOUGH;
        }
        creep.memory.dest = dest.id;
    }
    if(!creep.pos.isNearTo(dest)) {
        return creep.moveTo(dest);
    } else {
        // XXX minerals
        let ret = creep.transfer(dest, RESOURCE_ENERGY);
        switch(ret) {
        case OK:
            var delivery = creep.carry.energy;
            if(dest instanceof StructureLink) {
                var space = dest.energyCapacity - dest.energy;
                if(delivery > space) delivery = space;
            }
            creep.memory.delivered += delivery;
            if(dest instanceof StructureStorage) {
                creep.memory.dest = creep.memory.origDest;
            }
            // XXX bail out if we spin here for a while.
            if(delivery == creep.carry.energy) return fill(creep);
            break;
        case ERR_FULL:
            creep.memory.full++;
            if(creep.memory.full > 10) {
                creep.memory.dest = creep.room.storage.id;
            }
            break;
        default:
            console.log(`${creep.name} unable to deliver: ${ret}`);
            break;
        }
    }
}