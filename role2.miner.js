// Written to be a drop miner, but we probably want ~Adjacent Storage instead of
// pure drop.
const util = require('util');

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
spawn: function(spawn, destID = null) {
    const room = spawn.room;
    const extractors = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_EXTRACTOR});
    if(extractors.length == 0) return false;
    const minerals = room.find(FIND_MINERALS);
    const avail = _.sum(_.map(minerals, m => m.mineralAmount));
    
    if(DEBUG) console.log(`Extractor is yes. avail is ${avail}`);
    // Won't respawn unless we empty it.
    if(!avail) return false;
    
    // TOOD(baptr): Can switch from a global check if this becomes a drop miner again.
    const minIDs = _.map(minerals, m => m.id);
    if(_.filter(Game.creeps,c => c.memory.role == ROLE && minIDs.includes(c.memory.mineral))) {
        return false;
    }
    if(DEBUG) console.log('Existing creeps are ok');
    
    var dest = Game.getObjectById(destID);
    if(!dest) {
        dest = findDest(extractors[0]);
    }
    if(!dest) return false;
    if(DEBUG) console.log('Dest found');
    
    var availEng = room.energyAvailable;
    const maxEng = room.energyCapacityAvailable;
    if(availEng < maxEng*0.9) return false;
    if(DEBUG) console.log('Energy ok');
    
    // spawn is yes.
    
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