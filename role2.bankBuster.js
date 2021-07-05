const BodyBuilder = require('util.bodybuilder');
const util = require('util.creep');

const ROLE = 'bankBuster';

module.exports = {
  ROLE,
  spawn: function(spawn, targetRoom) {
    const body = new BodyBuilder([], spawn.room.energyAvailable);
    body.extend([MOVE, RANGED_ATTACK]);
    body.extend([MOVE]);

    if(body.count(RANGED_ATTACK) < 5) return ERR_NOT_ENOUGH_ENERGY;

    return spawn.spawnCreep(body.sort(), `${ROLE}-${spawn.room.name}-${Game.time}`, {memory: {
      role: ROLE,
      targetRoom,
      cost: body.cost,
      life: {},
    }});
  },
  run: function(creep) {
    util.track(creep, 'alive');

    // XXX Look for/shoot back at nearby enemies on the way.

    let target = Game.getObjectById(creep.memory.target);
    if(!target) {
      if(creep.pos.roomName != creep.memory.targetRoom) {
        return util.track(creep, 'move', creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom)));
      }

      target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if(!target) {
        target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
      }
      if(!target) {
        return util.track(creep, 'idle move', creep.moveTo(25, 25));
      }
    }
    creep.moveTo(target, {range: 2});
    if(creep.pos.inRangeTo(target, 4)) {
      return util.track(creep, 'ranged_attack', creep.rangedAttack(target));
    }
  },
};
