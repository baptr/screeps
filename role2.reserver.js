const BodyBuilder = require('util.bodybuilder');

const ROLE = 'reserver';

// First remote harvest operation notes:
// - unable to break through wall easily, did it by hand
// - reservers die quick, but even with 2 claims make pretty good progress
// took
//   - 3 reservers (2 CLAIM 2 MOVE) + first with WORK+MOVE to break through
//   - 2 dropHarvesters w/ 21 parts
//      - first (delivered 15976) (cost 1750)
//   - 2 haulers - 28 and 36 parts
// couldn't pick up nearly fast enough. a lot rotted

module.exports = {
ROLE,
spawn: function(spawn, targetRoom) {
    var body = new BodyBuilder([CLAIM, MOVE], spawn.room.energyAvailable);
    body.extend([CLAIM, MOVE]);
    
    if(body.count(CLAIM) < 2) {
        console.log(`${spawn} can't afford ${ROLE}: ${body.count(CLAIM)} CLAIM costs ${body.cost}`);
        return ERR_NOT_ENOUGH_ENERGY;
    }
    
    var mem = {
        role: ROLE,
        targetRoom: targetRoom,
        cost: body.cost,
    }
    const name = `${ROLE}-${targetRoom}-${Game.time}`;
    return spawn.spawnCreep(body.sort(), name, {memory: mem});
},
run: function(creep) {
    room = Game.rooms[creep.memory.targetRoom];
    if(!room) {
        creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom));
        return;
    }
    const ctrl = room.controller;
    switch(creep.pos.getRangeTo(ctrl)) {
    case 2:
        creep.moveTo(ctrl);
    case 1:
        if(creep.reserveController(ctrl) == OK) {
            creep.memory.delivered += creep.getActiveBodyparts(CLAIM);
        }
        break;
    default:
        return creep.moveTo(ctrl);
    }
},
};