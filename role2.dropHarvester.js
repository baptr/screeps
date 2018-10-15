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
// TODO(baptr): When dropping on the ground, pickup creeps get confused because
// the resource ID flaps.
// TODO(baptr): Is it actually better to time it perfectly, or to drain the
// the source as fast as possible? Slow and steady means more waiting...
// TODO(baptr): Limit number of harvester/source to the space available.
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
    
    var targetSource = pickSource(room);
    if(!targetSource) { return false; }
    
    var builder = new BodyBuilder([WORK, WORK, MOVE], availEnergy);
    
    builder.extend([WORK], limit=HARVESTER_WORKS - builder.count(WORK));
    builder.extend([CARRY], limit=1);
    builder.extend([MOVE], limit=builder.count(WORK)+builder.count(CARRY));
    builder.sort();
    
    const name = `${ROLE}-${room.name}-${Game.time}`
    var ret = spawn.spawnCreep(builder.body, name, {memory: {
        role: ROLE,
        src: targetSource.id,
    }});
    if(ret != OK) {
        console.log(`Spawning ${name} (${builder.body}) = ${ret}`);
    }
    return true;
},
run: function(creep) {
    var src = Game.getObjectById(creep.memory.src);
    if(!src) {
        console.log(`${creep.name} has invalid src ${creep.memory.src}`);
        return false;
    }
    if(creep.pos.inRangeTo(src, 1)) {
        var cont = Game.getObjectById(creep.memory.container);
        if(!cont) {
            cont = _.filter(creep.pos.lookFor(LOOK_STRUCTURES), s => s.structureType == STRUCTURE_CONTAINER)[0]
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
    } else {
        creep.moveTo(src);
        return;
    }
    var ret = creep.harvest(src);
    switch(ret) {
    case ERR_NOT_IN_RANGE:
        // Shouldn't happen with the range check above..
        creep.moveTo(src);
        break;
    case OK:
        // TODO(baptr): This is probably a little fuzzy if multiple are pulling from it when it runs out, but meh.
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
    }
},
ROLE,
pickSource,
};

// XXX this feels expensive...
// TODO(baptr): memoize the time to pay attention again?
function pickSource(room) {
    var existing = room.find(FIND_MY_CREEPS, {filter: c => c.memory.role == ROLE});
    
    var workParts = {};
    var numHarvesters = {};
    _.forEach(existing, c => {
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
    var assigned = function(id) { return workParts[id] || 0 };
    var existing = function(id) { return numHarvesters[id] || 0 };
    
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

const ELDER_EPSILON = 150; // TODO(baptr): tune.

// how many WORK parts to empty a source as it refills?
// - assuming no time to repair containers/move/etc
// - can be divided between multiple workers
// TODO(baptr): Spawn small versions early and drop asap, or let bootstrappers
// deal with it?
const HARVESTER_WORKS = SOURCE_ENERGY_CAPACITY / (HARVEST_POWER * ENERGY_REGEN_TIME); // (5)

// Could be smaller, but bootstrappers can handle the initial setup, so why bother?
const MIN_HARVESTER_BODY = [WORK, WORK, MOVE];
const MIN_HARVESTER_COST = util.bodyCost(MIN_HARVESTER_BODY);
