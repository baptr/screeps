const BodyBuilder = require('util.bodybuilder');
const util = require('util.creep');

const ROLE = 'keeperKiller';
module.exports = {
ROLE,
assigned: function(roomName) {
  return Object.values(Game.creeps).filter(c => c.role == ROLE && c.destRoom == roomName);
},
spawn: function(spawn, destRoom) {
    builder = new BodyBuilder([], spawn.room.energyAvailable);
    builder.extend([ATTACK, MOVE], limit=10)
    builder.extend([HEAL, MOVE], limit=5)
    builder.extend([MOVE], limit=15)
    builder.sort()
    if(builder.count(ATTACK) < 5) return ERR_NOT_ENOUGH_ENERGY;
    // Not as useful for l0 rooms..
    // if(builder.count(HEAL) < 2) return ERR_NOT_ENOUGH_ENERGY;
    
    const name = `${ROLE}-${destRoom}-${Game.time}`;
    const mem = {
        role: ROLE,
        destRoom: destRoom,
        cost: builder.cost,
        life: {},
    }
    return spawn.spawnCreep(builder.body, name, {memory: mem});
},
run: function(creep) {
    util.track(creep, 'alive');
    if(creep.hits < creep.hitsMax) {
      creep.heal(creep);
    } else {
      const friend = creep.pos.findInRange(FIND_MY_CREEPS, 1, {filter: c => c.hits < c.hitsMax}).shift();
      if(friend) creep.heal(frien);
    }

    let target = Game.getObjectById(creep.memory.target);
    if(!target) {
      if(creep.pos.roomName != creep.memory.destRoom) {
        return util.track(creep, 'move', creep.moveTo(new RoomPosition(25, 25, creep.memory.destRoom)));
      }
      target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
      if(!target) {
        target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
      }
      if(!target) {
        return util.track(creep, 'idle move', creep.moveTo(new RoomPosition(25, 25, creep.memory.destRoom)));
      }
      creep.memory.target = target.id;
    }
    util.track(creep, 'advance', creep.moveTo(target));
    if(creep.pos.inRangeTo(target, 2)) {
        return util.track(creep, 'attack', creep.attack(target));
    }
}
};
