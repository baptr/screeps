const BodyBuilder = require('util.bodybuilder');

const ROLE = 'keeperKiller';
module.exports = {
ROLE,
spawn: function(spawn, destRoom) {
    builder = new BodyBuilder([], spawn.room.energyAvailable);
    builder.extend([ATTACK, MOVE], limit=10)
    builder.extend([HEAL, MOVE], limit=5)
    builder.extend([TOUGH, MOVE])
    builder.sort()
    if(builder.count(ATTACK) < 5) return ERR_NOT_ENOUGH_ENERGY;
    if(builder.count(HEAL) < 2) return ERR_NOT_ENOUGH_ENERGY;
    
    const name = `${ROLE}-${destRoom}-${Game.time}`;
    const mem = {
        role: ROLE,
        destRoom: destRoom,
        cost: builder.cost,
    }
    return spawn.spawnCreep(builder.body, name, {memory: mem});
},
run: function(creep) {
    if(creep.hits < creep.hitsMax) creep.heal(creep);
    var target = Game.getObjectById(creep.memory.target);
    if(!target) {
        if(creep.pos.roomName != creep.memory.destRoom) {
            return creep.moveTo(new RoomPosition(25, 25, creep.memory.destRoom));
        }
        // XXX Path necessary?
        target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if(!target) {
            return creep.moveTo(new RoomPosition(25, 25, creep.memory.destRoom));
        }
        creep.memory.target = target.id;
    }
    creep.moveTo(target);
    if(creep.pos.inRangeTo(target, 2)) {
        creep.attack(target);
    }
}
};