const util = require('util');

const ROLE = 'dropMiner';

function findDest(ext) {
    const con = ext.pos.findInRange(FIND_STRUCTURES, 1, {filter:
        s => s.structureType == STRUCTURE_CONTAINER && _.sum(s.store) < s.storeCapacity,
    });
    return con[0];
}

module.exports = {
ROLE: ROLE,
spawn: function(spawn) {
    const room = spawn.room;
    const extractors = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_EXTRACTOR});
    if(extractors.length == 0) return false;
    const minerals = room.find(FIND_MINERALS);
    const avail = _.sum(_.map(minerals, m => m.mineralAmount));
    console.log(`Extractor is yes. avail is ${avail}`);
    if(avail <= 1000) return false;
    if(room.find(FIND_MY_CREEPS, {filter: c => c.memory.role == ROLE}).length >= extractors.length) return false;
    console.log('Existing creeps are ok');
    const dest = findDest(extractors[0]);
    if(!dest) return false;
    console.log('Room looks ok');
    
    var availEng = room.energyAvailable;
    const maxEng = room.energyCapacityAvailable;
    if(availEng < maxEng*0.9) return false;
    console.log('Energy ok');
    
    // spawn is yes.
    
    var body = [];
    const bodyNode = [WORK, WORK, MOVE];
    const costDelta = util.bodyCost(bodyNode);
    while(availEng - costDelta >= 0 && body.length + bodyNode.length <= MAX_CREEP_SIZE) {
        body.push(...bodyNode);
        availEng -= costDelta;
    }
    
    var ret = spawn.spawnCreep(body, `miner-${room.name}-${Game.time}`, {memory: {
        role: ROLE,
        extractor: extractors[0].id,
        mineral: minerals[0].id,
        dest: dest.id,
    }});
    if(ret != OK) {
        console.log(`Spawning ${ROLE} in ${room.name} (${body}) = ${ret}`);
    }
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
    // TODO(baptr): Better to check first?
    if(!creep.pos.isEqualTo(dest.pos)) {
        creep.moveTo(dest);
    } else {
        creep.harvest(min);
    }
}
};