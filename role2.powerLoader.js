const BodyBuilder = require('util.bodybuilder');
const resUtil = require('util.resources');

const ROLE = 'powerLoader';
module.exports = {
  ROLE,
  spawnCondition: function(room) {
    if(!room.storage || !room.storage.store.power) return false;
    if(room.find(FIND_MY_CREEPS, {filter: c => c.memory.role == ROLE}).length) return false;
    return true;
  },
  spawn: function(spawn) {
    // TODO: could get away with very little move since we *should* be on roads.
    const body = new BodyBuilder([MOVE, CARRY], spawn.room.energyAvailable)
    body.extend([MOVE, CARRY], limit=3);
    return spawn.spawnCreep(body.sort(), `powerLoader-${spawn.room.name}-${Game.time}`, {memory: {
      role: ROLE,
      cost: body.cost,
    }});
  },
  run: function(creep) {
    const bank = creep.room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_POWER_SPAWN}}).shift();
    if(!bank) return;
    bank.processPower();

    const store = creep.room.storage;
    if(!store) return;
    if(bank.store.power < 50 && (creep.store.power || creep.store.getFreeCapacity())) { // XXX handle running out of power
      if(creep.store.power == 0) {
        creep.moveTo(store);
        const want = Math.min(creep.store.getFreeCapacity(), 100-bank.store.power, store.power);
        creep.withdraw(store, RESOURCE_POWER, want);
      } else {
        creep.moveTo(bank);
        if(creep.transfer(bank, RESOURCE_POWER) == OK) {
          creep.memory.delivered += creep.store.power;
        }
      }
    } else {
      if(creep.store.energy) {
        creep.moveTo(bank);
        if(creep.transfer(bank, RESOURCE_ENERGY) == OK) {
          creep.memory.delivered += creep.store.energy;
        }
      } else {
        const src = resUtil.findSrc(creep);
        if(!src) return;
        creep.moveTo(src);
        creep.withdraw(src, RESOURCE_ENERGY);
      }
    }
  },
};
