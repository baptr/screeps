const BodyBuilder = require('util.bodybuilder');
const util = require('util.creep');

const ROLE = 'bankBuster';

module.exports = {
  ROLE,
  assigned: function(roomName) {
    return Object.values(Game.creeps).filter(c => c.memory.role == ROLE && c.memory.targetRoom == roomName);
  },
  spawn: function(spawn, targetRoom) {
    const body = new BodyBuilder([], spawn.room.energyAvailable);
    body.extend([MOVE, RANGED_ATTACK]);
    body.extend([MOVE]);

    if(body.count(RANGED_ATTACK) < 3) return ERR_NOT_ENOUGH_ENERGY;

    return spawn.spawnCreep(body.sort(), `${ROLE}-${spawn.room.name}-${Game.time}`, {memory: {
      role: ROLE,
      targetRoom,
      cost: body.cost,
      life: {},
    }});
  },
  run: function(creep) {
    util.track(creep, 'alive');

    if(creep.room.find(FIND_FLAGS).find(f => f.name == 'wait')) return;

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
        // For broken banks, maybe flee the resources but stay closer by?
        return util.track(creep, 'idle move', creep.moveTo(25, 25));
      }
    }

    // TODO: Make space for melee replacements to get through
    const range = creep.pos.getRangeTo(target);
    if(range > 3) creep.moveTo(target, {range: 3});
    if(range <= 4) {
      const ret = util.track(creep, 'ranged_attack', creep.rangedAttack(target));
      if(ret == OK) creep.memory.delivered += creep.getActiveBodyparts(RANGED_ATTACK)*RANGED_ATTACK_POWER;
      return ret
    }
  },
};
