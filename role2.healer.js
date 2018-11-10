const BodyBuilder = require('util.bodybuilder');
const ROLE = 'healer';

module.exports = {
ROLE,
spawn: function(spawn, targetRoom) {
    var body = new BodyBuilder([], spawn.room.energyAvailable);
    body.extend([HEAL, MOVE]);
    if(body.count(HEAL) < 6) return ERR_NOT_ENOUGH_ENERGY;
    const name = `${ROLE}-${spawn.room.name}-${Game.time}`;
    var mem = {
        role: ROLE,
        targetRoom: targetRoom,
    };
    return spawn.spawnCreep(body.sort(), name, {memory: mem});
},
run: function(creep) {
    const rm = creep.memory.targetRoom;
    if(rm) {
        if(creep.room.name != rm) {
            return creep.moveTo(new RoomPosition(25, 25, rm));
        } else {
            // Get off the exit.
            creep.moveTo(new RoomPosition(25, 25, rm));
            delete creep.memory.targetRoom;
        }
    }
    var friend = Game.getObjectById(creep.memory.friend);
    if(friend && friend.hits == friend.hitsMax) {
        friend = null;
    }
    if(!friend) {
        friend = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
            filter: c => c.hits < c.hitsMax
        });
        if(friend) creep.memory.friend = friend.id;
    }
    if(friend) {
        creep.moveTo(friend);
        creep.heal(friend);
    }
}
};