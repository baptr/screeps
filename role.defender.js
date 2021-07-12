const BodyBuilder = require('util.bodybuilder');
const local = require('local');

// TODO: Finish modernization, but it's hard to match the same algorithm with
// BodyBuilder.
function mkBody(spawn) {
  const body = new BodyBuilder([], spawn.room.energyAvailable);
  body.extend([MOVE, MOVE, RANGED_ATTACK], limit=3);
  body.extend([MOVE, MOVE, HEAL], limit=2);
  body.extend([MOVE, MOVE, RANGED_ATTACK], limit=3);
  body.extend([MOVE, MOVE, HEAL], limit=2);
  body.extend([MOVE, RANGED_ATTACK]);
  return body;
}

const ROLE = 'defender';

module.exports = {
  ROLE,
  assigned: function(roomName) {
    return Object.values(Game.creeps).filter(c => {
      if(c.memory.reloNextRole == ROLE && c.memory.reloRoom == roomName) return true;
      if(c.memory.role != ROLE) return false;
      if(c.memory.targetRoom == roomName) return true;
      return c.pos.roomName == roomName;
    });
  },
    // spawn a defender creep using as much of the available energy as possible.
    spawn: function(spawn, mem={}) {
       var available = spawn.room.energyAvailable;
       const rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
       const toughCost = BODYPART_COST[TOUGH] + BODYPART_COST[MOVE];
       const healCost = BODYPART_COST[HEAL] + BODYPART_COST[MOVE];
       const meleeCost = BODYPART_COST[ATTACK] + BODYPART_COST[MOVE]; // TODO factor in
       
       var body = [];
       if(available > 5*rangedCost) {
           body.push(HEAL, MOVE);
           available -= healCost;
       }
       if(available > 4*rangedCost) {
           body.push(TOUGH, MOVE);
           available -= toughCost;
       }
       while(available > rangedCost) {
           body.push(RANGED_ATTACK, MOVE)
           available -= rangedCost;
       }
       if(body.length == 0) {
           // Can't actually afford any ranged attack. Could try without a MOVE
           // Or fall back on ATTACK body. But for now, just wait.
           return false;
       }
       while(available > toughCost) {
           body.push(TOUGH, MOVE);
           available -= toughCost;
       }
       if(body.length > MAX_CREEP_SIZE) {
           body = body.slice(0, MAX_CREEP_SIZE);
       }
       // body cost is a reasonable sort for TOUGH < MOVE < ATTACK
       // TODO(baptr): Though MOVE should be spent first, probably...
       body.sort((a,b) => BODYPART_COST[a] - BODYPART_COST[b]);
       mem.role = ROLE;
       return spawn.spawnCreep(body, 'defender_'+Game.time, {memory: mem});
    },
    run: function(creep) {
      let enemy = Game.getObjectById(creep.memory.enemy);
      if(!enemy) {
        enemy = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if(enemy) creep.memory.enemy = enemy.id;
      }
      if(enemy) creep.moveTo(enemy);

      if(creep.hits < creep.hitsMax) {
        creep.rangedMassAttack();
        creep.heal(creep);
      } else {
        const friend = creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
        if(friend) {
          const range = creep.pos.getRangeTo(friend);
          if(range == 1) {
            creep.rangedMassAttack();
            creep.heal(friend);
          } else if(!enemy) {
            creep.rangedHeal(friend);
          }
          creep.moveTo(friend);
        }
      }

      if(!enemy) {
        if(creep.memory.targetRoom && creep.memory.targetRoom != creep.room.name) {
          return creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom));
        } else {
          creep.moveTo(25, 25, {range: 3});
        }
      }

      const enemySites = creep.room.find(FIND_CONSTRUCTION_SITES).filter(cs => !cs.my);
      const tower = enemySites.sort((a, b) => b.progress - a.progress).find(s => s.structureType == STRUCTURE_TOWER && s.progress);
      if(tower) {
        creep.moveTo(tower);
        if(creep.pos.isEqualTo(tower.pos)) creep.move(0,0); // Hack to not stay on it if it was placed under us.
        creep.rangedMassAttack();
        return;
      }

      // TODO(baptr): Prioritize healers.
      if(!enemy) {
        enemy = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
      }
      if(!enemy) {
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        // TODO: Only keep the N~=3? best, and move them out of the way.
        if(spawn && !local.defenseRooms[creep.room.name]) {
          creep.say("🔙 to dust!");
          creep.moveTo(spawn);
          spawn.recycleCreep(creep);
          creep.heal(creep);
          return false;
        }
        const gather = Game.flags.gather;
        if(gather && gather.pos.roomName == creep.pos.roomName) {
          creep.moveTo(gather.pos, {range: 3});
        }
      } else {
        creep.say('Yarrrrr', true);
        const range = creep.pos.getRangeTo(enemy);
        if(range > 3) {
          creep.moveTo(enemy, {reusePath: 0});
        }
        const baddies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
        const scary = baddies.filter(c => c.getActiveBodyparts(ATTACK) + c.getActiveBodyparts(RANGED_ATTACK));
        const nearBy = creep.pos.findInRange(baddies, 3);
        if(nearBy.length > 2) {
          // TODO: calculate damage?
          creep.rangedMassAttack();
          creep.heal(creep);
        } else {
          if(creep.rangedAttack(enemy) == OK) {
            creep.memory.delivered += creep.getActiveBodyparts(RANGED_ATTACK) * RANGED_ATTACK_POWER;
          }
        }
        if(scary.length) {
          const path = PathFinder.search(creep.pos, scary.map(b => ({range: 3, pos: b.pos})), {flee: true, maxCost: 100});
          if(path.path.length) {
            creep.move(creep.pos.getDirectionTo(path.path[0]));
          }
        }
      }
   }
};
