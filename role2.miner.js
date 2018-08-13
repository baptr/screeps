// Written to be a drop miner, but we probably want ~Adjacent Storage instead of
// pure drop.
const util = require('util.creep');
const carrier = require('role2.carrier');

const ROLE = 'dropMiner';

const DEBUG = false;

function findDest(ext) {
    const con = ext.pos.findInRange(FIND_STRUCTURES, 1, {filter:
        s => s.structureType == STRUCTURE_CONTAINER && _.sum(s.store) < s.storeCapacity,
    });
    return con[0];
}

module.exports = {
ROLE: ROLE,
spawn: function(spawn, opts) {
    if(!opts) opts = {};
    const room = spawn.room;
    
    // Special case for ghodium destinations: just spawn a carrier
    var dest = Game.getObjectById(opts.dest);
    if(dest instanceof StructureLab && dest.mineralType == RESOURCE_GHODIUM) {
        var src = Game.getObjectById(opts.src);
        if(!src) {
            // Find the matching lab here to pull from.
            src = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType == STRUCTURE_LAB && s.mineralType == RESOURCE_GHODIUM,
            })[0];
        }
        if(!src) {
            console.log("Failed to spawn Ghodium carrier, no src lab in", room);
            return false;
        }
        return carrier.spawn(spawn, opts);
    }
    
    // TODO(baptr): Improve more of this using the src/res in opts.
    const extractors = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_EXTRACTOR});
    if(extractors.length == 0) {
        if(DEBUG) console.log(room, "missing extractor");
        return false;
    }
    const minerals = room.find(FIND_MINERALS);
    const avail = _.sum(_.map(minerals, m => m.mineralAmount));
    
    // Won't respawn unless we empty it.
    if(!avail) {
        if(DEBUG) console.log(room, "no minerals available");
        return false;
    }
    
    // TOOD(baptr): Can switch from a global check if this becomes a drop miner again.
    const minIDs = _.map(minerals, m => m.id);
    const oldMiners = _.filter(Game.creeps,c => c.memory.role == ROLE && minIDs.includes(c.memory.mineral));
    if(oldMiners.length) {
        if(!opts.dest || _.filter(oldMiners, c => c.memory.dest == opts.dest).length) {
            if(DEBUG) console.log(`${room.name} has pre-existing ${minIDs} miners (${oldMiners})`);
            return false;
        }
    }
    
    if(!dest) {
        dest = findDest(extractors[0]);
    }
    if(!dest) {
        if(DEBUG) console.log(room, "unable to find destination");
        return false;
    }
    
    var availEng = room.energyAvailable;
    const maxEng = room.energyCapacityAvailable;
    if(availEng < 3000) {
        if(DEBUG) console.log(`${room} energy ${availEng} < ${maxEng*0.9}`);
        return false;
    }
    
    console.log(room, "spawn is yes.");
    
    var body = [WORK, MOVE, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
    availEng -= util.bodyCost(body);
    const bodyNode = [WORK, WORK, MOVE, MOVE];
    const costDelta = util.bodyCost(bodyNode);
    while(availEng >= costDelta && body.length + bodyNode.length <= MAX_CREEP_SIZE) {
        body.push(...bodyNode);
        availEng -= costDelta;
    }
    // Order WORK -> MOVE -> CARRY (-> 1 MOVE) to soak some damage if necessary.
    const order = {};
    order[WORK] = 1;
    order[MOVE] = 2;
    order[CARRY] = 3;
    body.sort((a, b) => order[a] - order[b]);
    
    var ret = spawn.spawnCreep(body, `miner-${room.name}-${Game.time}`, {memory: {
        role: ROLE,
        extractor: extractors[0].id,
        mineral: minerals[0].id,
        dest: dest.id,
        filling: true,
    }});
    if(ret != OK) {
        console.log(`Spawning ${ROLE} in ${room.name} (${body}) = ${ret}`);
    }
    return ret;
},
run: function(creep) {
    const ext = Game.getObjectById(creep.memory.extractor);
    const min = Game.getObjectById(creep.memory.mineral);
    var dest = Game.getObjectById(creep.memory.dest);
    if(!ext || !min || !dest) {
        console.log(`${creep.name} missing expected objects: ${ext} ${min} ${dest}`);
        return;
    }
    if(_.sum(dest.store) >= dest.storeCapacity) {
        // Look for a new dest. If none available, do nothing.
        dest = findDest(ext);
        // XXX Try to build one
        if(!dest) return false;
        // TODO(baptr): Should the old one be deleted sooner?
        creep.memory.dest = dest.id;
    }
    if(creep.memory.filling) {
        var ret = creep.harvest(min);
        switch(ret) {
        case ERR_NOT_IN_RANGE: creep.moveTo(min); break;
        case OK: break; // TODO stats
        }
        // TODO(baptr): probably better to check if it's near dest
        if(creep.carryCapacity > 0 && _.sum(creep.carry) >= creep.carryCapacity) {
            creep.memory.filling = false;
        }
    } else {
        var ret = creep.transfer(dest, min.mineralType);
        switch(ret) {
        case ERR_NOT_IN_RANGE:
            creep.moveTo(dest);
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.memory.filling = true;
            break;
        case ERR_FULL: // TODO(baptr): probably something better to do than wait
            break;
        case OK:
            break;
        default:
            console.log(`${creep.name} delivery: ${ret}`);
        }
    }
}
};