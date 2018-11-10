/* Profiling stats 2018-08-10
calls	time	avg		function
4655	1135.1	0.244	role.dropHarvester.run
4623	596.1	0.129	Creep.harvest
1687	365.7	0.217	Creep.repair
6342	20.2	0.003	RoomPosition.inRangeTo
2600	9.5		0.004	Creep.getActiveBodyparts
32		8.9		0.278	Creep.moveTo
2606	8.5		0.003	RoomPosition.isNearTo
32		6.6		0.205	Creep.move
26		5.6		0.214	Creep.moveByPath
6		1.1		0.179	RoomPosition.findPathTo
6		1.0		0.164	Room.findPath
2		0.1		0.026	RoomPosition.lookFor
12		0.1		0.004	RoomPosition.isEqualTo
2		0.0		0.010	Room.lookForAt
Avg: 18.47	Total: 7314.72	Ticks: 396
*/

const util = require('util.creep');
const pathing = require('util.pathing');
const BodyBuilder = require('util.bodybuilder');

// Mostly-WORK harvester that drops on the ground (or in containers if 
// available).
// Important to optimize source withdrawal, since the regen timer doesn't start
// until the first harvest each time.
//
// TODO(baptr): Is it actually better to time it perfectly, or to drain the
// the source as fast as possible? Slow and steady means more waiting...
// TOOD(baptr): Create a second container if the first one is filling up. (But 
// remember 5 limit)
const ROLE = 'dropHarvester';
module.exports = {
// XXX room vs spawn
spawnCondition: function(room, roomKinds) {
    var numRole = r => (roomKinds[r] || []).length;
},
spawn: function(spawn) {
    var room = spawn.room;
    const availEnergy = room.energyAvailable;
    if(availEnergy < MIN_HARVESTER_COST || spawn.spawning) { return false; }
    
    const targetSource = pickSource(room);
    if(!targetSource) { return false; }
    
    var builder = new BodyBuilder([WORK, WORK, MOVE], availEnergy);
    
    builder.extend([WORK, WORK, MOVE], limit=(HARVESTER_WORKS - builder.count(WORK))/2);
    builder.extend([CARRY, MOVE], limit=1);
    builder.sort();
    
    const name = `${ROLE}-${room.name}-${Game.time}`
    var ret = spawn.spawnCreep(builder.body, name, {memory: {
        role: ROLE,
        src: targetSource.id,
        cost: builder.cost,
    }});
    if(ret != OK) {
        console.log(`Spawning ${name} = ${ret}`);
    }
    return true;
},
spawnRemote: function(spawn, srcID, srcRoom) {
    if(!srcID || !srcRoom) {
        console.log('Invalid args to spawnRemote. Need srcID, srcRoom');
        return ERR_INVALID_ARGS;
    }
    var builder = new BodyBuilder([WORK, WORK, MOVE], spawn.room.energyAvailable);
    builder.extend([WORK, WORK, MOVE]);
    builder.extend([CARRY, CARRY, MOVE], limit=1);
    if(builder.count(WORK) < 10) { // randomly chosen. TODO: math
        console.log("Not worth remote dropHarvesting");
        return false;
    }
    const name = `${ROLE}-${srcRoom}-${Game.time}`;
    var ret = spawn.spawnCreep(builder.sort(), name, {memory: {
        role: ROLE,
        src: srcID,
        cost: builder.cost,
        remoteRoom: srcRoom,
    }})
},
run: function(creep) {
    var src = Game.getObjectById(creep.memory.src);
    if(!src) {
        if(creep.memory.remoteRoom) {
            return creep.moveTo(new RoomPosition(25, 25, creep.memory.remoteRoom));
        }
        console.log(`${creep.name} has invalid src ${creep.memory.src}`);
        return false;
    }
    if(!creep.pos.isNearTo(src)) {
        // XXX need to prevent repositioning for a different container from
        // flapping against this.
        return creep.moveTo(src);
    }
    
    // In range...
    
    var cont = Game.getObjectById(creep.memory.container);
    if(!cont && !creep.memory.remoteRoom) {
        var conts = src.pos.findInRange(FIND_MY_STRUCTURES, 1, {
            filter: {structureType: STRUCTURE_CONTAINER}
        });
        // Should avoid one if there's already a drop harvester on it...
        // But maybe wait/bump any other type?
        cont = creep.pos.findClosestByPath(conts, {filter: s => {
            if(s.pos.lookFor(LOOK_CREEPS).length) {
                return false;
            }
            if(_.sum(s.store) == s.storeCapacity) {
                // TODO(baptr): better than nothing, though...
                return false;
            }
            return true;
        }})
        if(!cont) {
            // may already exist, we'll check next
            // TODO(baptr): Only 5 containers per room, should prioritize
            // standing on one
            var ret = creep.room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER);

            cont = _.filter(creep.pos.lookFor(LOOK_CONSTRUCTION_SITES), s => s.structureType == STRUCTURE_CONTAINER)[0];
            if(!cont && ret == ERR_RCL_NOT_ENOUGH) {
                // Don't save it in case we don't make it.
                // TODO(baptr): Could probably cause flapping...
                var destCont = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_CONTAINER});
                if(destCont && creep.pos.inRangeTo(destCont, 1)) {
                    creep.moveTo(destCont);
                }
            }
        }
        if(cont) {
            creep.memory.container = cont.id;
        }
    }
    if(cont && _.sum(cont.store) == cont.storeCapacity) {
        let swap = creep.pos.findInRange(FIND_STRUCTURES, 1, {filter: s =>
            s.structureType == STRUCTURE_CONTAINER && s.isNearTo(src) &&
            _.sum(s.store) < s.storeCapacity
        })[0];
        if(swap) {
            console.log(`${creep.name} full, repositioning`);
            cont = swap;
            creep.memory.container = swap.id;
        }
    }
    if(cont && !creep.pos.isEqualTo(cont.pos)) {
        creep.moveTo(cont);
    }
        
    var ret = creep.harvest(src);
    switch(ret) {
    case ERR_NOT_IN_RANGE:
        // Shouldn't happen with the range check above..
        creep.moveTo(src);
        break;
    case OK:
        // TODO(baptr): This is probably a little fuzzy if multiple are pulling
        // from it when it runs out, but meh.
        creep.memory.delivered += Math.min(creep.getActiveBodyparts(WORK)*HARVEST_POWER, src.energy);
        break;
    case ERR_NOT_ENOUGH_RESOURCES:
        if(creep.carry.energy > 0 && cont) {
            if(cont instanceof ConstructionSite) {
                creep.build(cont);
            } else {
                creep.repair(cont);
            }
        }
        break;
    default:
        console.log(`${creep.name} unhandled harvest ret: ${ret}`);
    }
},
ROLE,
pickSource,
};

// XXX this feels expensive...
// TODO(baptr): memoize the time to pay attention again?
function pickSource(room) {
    var harvesters = room.find(FIND_MY_CREEPS, {filter: c => c.memory.role == ROLE});
    
    var workParts = {};
    var numHarvesters = {};
    _.forEach(harvesters, c => {
        // TODO(baptr): Feels like there should be a better way to write this.
        let src = c.memory.src;
        if(workParts[src] == null) {
            workParts[src] = 0;
            numHarvesters[src] = 0;
        }
        if(c.ticksToLive > ELDER_EPSILON) {
            workParts[src] += c.getActiveBodyparts(WORK);
            numHarvesters[src]++;
        }
    });
    const assigned = function(id) { return workParts[id] || 0 };
    const existing = function(id) { return numHarvesters[id] || 0 };
    
    var sources = room.find(FIND_SOURCES);
    sources.sort((a,b) => assigned(a.id)-assigned(b.id));
    
    for(var i = 0; i < sources.length; i++) {
        var s = sources[i];
        if(assigned(s.id) >= HARVESTER_WORKS) {
            continue;
        }
        if(existing(s.id) >= pathing.spacesNear(s.pos).length) {
            continue;
        }
        return s;
    }
    return null;
}

function pickPosition(creep, src) {
    // TODO(baptr): Any risk of container not being near source?
    var cont = Game.getObjectById(creep.memory.container);
    if(cont && _.sum(cont.store) < cont.storeCapacity) {
        return cont.pos;
    }
    
    var conts = src.pos.findInRange(FIND_MY_STRUCTURES, 1, {
        filter: {structureType: STRUCTURE_CONTAINER}
    });
    var free = _.filter(conts, s => {
        let occupant = s.pos.lookFor(LOOK_CREEPS);
        return !occupant.length || occupant[0].id == creep.id;
    });
    var cap = _.filter(free, s => _.sum(s.store) < s.storeCapacity);
    cont = creep.pos.findClosestByPath(cap);
    if(cont) {
        creep.memory.container = cont.id;
        return cont.pos;
    }
    if(conts.length >= 2 || conts.length >= pathing.spacesNear(src)) {
        // Don't really want to build more.
        cont = creep.pos.findClosestByPath(free);
        if(cont) {
            creep.memory.container = cont.id;
            return cont.pos;
        } else {
            return null;
        }
    }
    
    // Build one.
    // Maybe - get a path to the source and build at the last position?
    /*
    var ret = creep.room.createConstructionSite(pos, STRUCTURE_CONTAINER);
    if(ret == OK) {
        // memoize the container position?
        return pos;
    }
    
       if(!cont) {
            // may already exist, we'll check next
            // TODO(baptr): Only 5 containers per room, should prioritize
            // standing on one
            var ret = creep.room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER);

            cont = _.filter(creep.pos.lookFor(LOOK_CONSTRUCTION_SITES), s => s.structureType == STRUCTURE_CONTAINER)[0];
            if(!cont && ret == ERR_RCL_NOT_ENOUGH) {
                // Don't save it in case we don't make it.
                // TODO(baptr): Could probably cause flapping...
                var destCont = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_CONTAINER});
                if(destCont && creep.pos.inRangeTo(destCont, 1)) {
                    creep.moveTo(destCont);
                }
            }
        }
        if(cont) {
            creep.memory.container = cont.id;
        }
    }
    */
}

// TODO(baptr): Tune. It should allow for spawn+travel time.
const ELDER_EPSILON = 75;

// how many WORK parts to empty a source as it refills?
// - assuming no time to repair containers/move/etc
// - can be divided between multiple workers
// TODO(baptr): Spawn small versions early and drop asap, or let bootstrappers
// deal with it?
const HARVESTER_WORKS = 1 + SOURCE_ENERGY_CAPACITY / (HARVEST_POWER * ENERGY_REGEN_TIME); // (5)

// Could be smaller, but bootstrappers can handle the initial setup, so why bother?
const MIN_HARVESTER_BODY = [WORK, WORK, MOVE];
const MIN_HARVESTER_COST = util.bodyCost(MIN_HARVESTER_BODY);
