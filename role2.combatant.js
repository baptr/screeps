const util = require('util');

const ROLE = 'combatant';

const MIN_BODY = [RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

/*
  Thoughts
  - Coordinated attack between ~all rooms.
  - Spawn a bunch at once, meet up at some staging room, attack en masse.
    - Spawn over multiple waves?
    - Does that require higher level control than per-creep?
  - Specialized roles? healer, ranged, melee, tank?
*/
module.exports = {
ROLE: ROLE,
spawn: function(spawn, gather) {
    const energyAvailable = spawn.room.energyAvailable;
    // XXX find a cleaner way to save up
    if(energyAvailable < MIN_COST*2 || spawn.spawning) { return false; }
    
    var body = MIN_BODY.slice();
    var cost = MIN_COST;
    
    var extend = function(parts, limit=0) {
        let c = util.bodyCost(parts);
        let i = 0;
        while(cost + c <= energyAvailable && body.length + parts.length <= MAX_CREEP_SIZE) {
            body.push(...parts);
            cost += c;
            i++;
            if(limit > 0 && i >= limit) {
                break;
            }
        }
    }
    
    extend([ATTACK, MOVE], limit=8);
    extend([TOUGH, MOVE]);
    
    const bodySort = {};
    bodySort[TOUGH] = 1;
    bodySort[RANGED_ATTACK] = 2;
    bodySort[MOVE] = 3;
    bodySort[ATTACK] = 4;
    body.sort((a, b) => bodySort[a] - bodySort[b]);
    
    spawn.spawnCreep(body, `${ROLE}-${spawn.name}-${Game.time}`, {memory: {
        role: ROLE,
        gather: gather,
        target: '5b3e37ef8610fd40ae683f3b'
    }});
},
run: function(creep) {
    var gather = creep.memory.gather;
    if(gather) {
        gather = new RoomPosition(gather.x, gather.y, gather.roomName);
        creep.moveTo(gather);
        if(creep.pos.inRangeTo(gather, 5)) {
            delete creep.memory.gather;
        }
        return;
    }
    if(!creep.memory.charge && creep.ticksToLive > 300) return;
    
    var target = Game.getObjectById(creep.memory.target);
    if(!target) {
        target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, s => s.structureType != STRUCTURE_CONTROLLER);
        if(!target) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        }
        if(target) creep.memory.target = target.id;
    }
    if(target) {
        var ret = creep.attack(target);
        switch(ret) {
        case ERR_NOT_IN_RANGE:
            var movRet = creep.moveTo(target);
            if(creep.rangedAttack(target) == OK) return;
            if(movRet == ERR_NO_PATH) {
                var bad = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
                if(bad) {
                    creep.memory.target = bad.id;
                    creep.attack(bad);
                    creep.moveTo(bad);
                }
            }
            break;
        case OK:
            break;
        default:
          console.log(`${creep.name} attack ${target}: ${ret}`);
        }
        return;
    }
}
};