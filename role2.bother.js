const BodyBuilder = require('util.bodybuilder');

const ROLE = 'bother';
module.exports = {
  ROLE,
  spawn: function(spawn, targetRoom) {
    const body = new BodyBuilder([ATTACK, ATTACK, RANGED_ATTACK, HEAL], spawn.room.energyAvailable);
    body.extend([MOVE], limit=11); // enough for 1/2 in swamps, +1.
    if(body.count(MOVE) < 7) { // 1/3 in swamps
      return ERR_NOT_ENOUGH_ENERGY; 
    }
    spawn.spawnCreep(body.sort(), `bother-${targetRoom}-${Game.time}`, {memory: {
      role: ROLE,
      targetRoom,
      cost: body.cost,
      life: {},
    }});
  },
  run: function(creep) {
    if(creep.hits < creep.hitsMax) creep.heal(creep);

    if(creep.pos.room.name != creep.memory.targetRoom) {
      const enemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
      if(enemies.length) {
        const target = creep.pos.findClosestByPath(enemies);
        if(target) {
          const range = creep.pos.getRangeTo(target);
          if(range == 1) {
            creep.attack(target);
            creep.rangedMassAttack();
          } else {
            if(enemies.length > 1) {
              creep.heal(creep);
              creep.rangedMassAttack();
            } else {
              creep.rangedAttack(target);
            }
          }
        }
      }
      // TODO else: heal nearby friends

      return creep.moveTo(25, 25, creep.memory.targetRoom);
    }

    const enemySites = creep.room.find(FIND_CONSTRUCTION_SITES).filter(cs => !cs.my);
    const tower = enemySites.sort((a, b) => b.progress - a.progress).find(s => s.structureType == STRUCTURE_TOWER && s.progress);
    if(tower) {
      creep.moveTo(tower);
      if(creep.pos.isEqualTo(tower.pos)) creep.move(0,0); // Hack to not stay on it if it was placed under us.
      creep.rangedMassAttack();
      return;
    }

    const room = Game.rooms[creep.memory.targetRoom] || creep.room;
    // XXX do value checks to priotize healers and damage sources
    let target = Game.getObjectById(creep.memory.target);
    if(!target) {
      target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
      if(target) creep.memory.target = target.id;
    }
    // TODO: stomp important CSes
    // TODO: towers first, probably?
    if(!target) {
      target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
      if(target) creep.memory.target = target.id;
    }
    if(target) creep.moveTo(target);
  },
};
