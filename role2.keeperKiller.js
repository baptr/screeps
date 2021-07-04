const BodyBuilder = require('util.bodybuilder');

const ROLE = 'keeperKiller';
module.exports = {
ROLE,
assigned: function(roomName) {
  return Object.values(Game.creeps).filter(c => c.role == ROLE && c.destRoom == roomName);
},
spawn: function(spawn, destRoom) {
    builder = new BodyBuilder([], spawn.room.energyAvailable);
    builder.extend([ATTACK, MOVE, MOVE], limit=10)
    builder.extend([HEAL, MOVE, MOVE], limit=5)
    builder.sort()
    if(builder.count(ATTACK) < 5) return ERR_NOT_ENOUGH_ENERGY;
    // Not as useful for l0 rooms..
    // if(builder.count(HEAL) < 2) return ERR_NOT_ENOUGH_ENERGY;
    
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

    let target = Game.getObjectById(creep.memory.target);
    if(!target) {
      if(creep.pos.roomName != creep.memory.destRoom) {
        return creep.moveTo(new RoomPosition(25, 25, creep.memory.destRoom));
      }
      target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
      if(!target) {
        target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
      }
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
