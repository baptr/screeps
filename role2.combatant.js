const util = require('util.creep');
const pathing = require('util.pathing');

const ROLE = 'combatant';

const MIN_BODY = [RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

function run(creep) {
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
        
        var creeps = creep.room.find(FIND_HOSTILE_CREEPS);
        // TODO(baptr): Prioritize healers >~ dangerous attackers >~ towers >~ weak attackers?
        // TODO(baptr): Ideally we'd get in their face, but fall back on getting within range...
        // TODO(baptr): Dynamically re-prioritize based on melee:ranged attack power?
        // TODO(baptr): Figure out when to rangedMassAttack.
        var meleeGoals = _.map(creeps, c => c.pos);
        var rangeGoals = _.map(creeps, c => {return {pos: c.pos, range: 3}});
        // TODO(baptr): there's probably a reasonable max cost once we're in the room...
        // TODO(baptr): Share the cost matrix between attackers
        var costMatrix
        PathFinder.search(creep.pos, meleeGoals, {maxRooms: 1, maxCost: 100});
        
        
        target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, s => s.structureType != STRUCTURE_CONTROLLER);
        if(!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter:
                c => !c.pos.lookFor(LOOK_STRUCTURES, {filter: s => s.structureType == STRUCTURE_RAMPART}).length
            });
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
                delete creep.memory.target;
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
spawn: function(spawn, gather, target) {
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
        target: target || '5b6861648610fd40ae7f3f7e',
    }});
},
run: run, 
};