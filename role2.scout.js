const util = require('util.creep');
const pathUtil = require('util.pathing');
const scoutUtil = require('util.scout');

const ROLE = 'scout';
const BODY = [MOVE, MOVE];
const BODY_COST = util.bodyCost(BODY);

module.exports = {
ROLE,
exists: function(room) {
    return Object.values(Memory.creeps).find(c => c.role == ROLE && c.target == room);
},
spawn: function(targetRoom) {
    const name = `${ROLE}-${targetRoom}-${Game.time}`;
    
    // find an idle spawner as near the room as possible..
    const spawns = Object.values(Game.spawns).filter(s => s.isActive() && !s.spawning && s.room.energyAvailable >= BODY_COST);
    const [spawn, path] = pathUtil.macroClosest(targetRoom, spawns, {flipPath: true});
    if(!path) return ERR_NO_PATH;
    const longPath = pathUtil.longPath(spawn.pos, new RoomPosition(25, 25, targetRoom), {
      macroPath: path,
      swampCost: 1,
      range: 10,
    });
    if(longPath == ERR_NO_PATH) return ERR_NO_PATH;

    const ret = spawn.spawnCreep(BODY, name, {memory: {
      target: targetRoom,
      exitPath: pathUtil.exitPath(longPath),
      role: ROLE,
      cost: BODY_COST,
    }});
    if(ret == OK) console.log(`Spawning ${name} from ${spawn}`);
    return ret;
},
run: function(creep) {
    const target = creep.memory.target;
    if(!target) {
      console.log(`${creep.name} has nothing to do, good day!`);
      creep.suicide();
    }
    if(scoutUtil.needsUpdate(creep.pos.roomName)) {
      scoutUtil.update(creep.room);
    }

    if(creep.memory.roomPath || creep.memory.exitPath) {
      return pathUtil.macroMove(creep, {plainCost: 1, swampCost: 1});
    }
    return creep.moveTo(new RoomPosition(25, 25, target), {visualizePathStyle: {}, reusePath: 100});
}
};
