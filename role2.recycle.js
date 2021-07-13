const pathUtil = require('util.pathing');

const ROLE = 'recycle';
module.exports = {
ROLE,
convert: function(creep, spawn=null) {
  // TODO: Check other rooms.
  if(!spawn) spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
  if(!spawn) {
    console.log(`No where for ${creep.name} to recycle`);
    return false;
  }
  if(creep.pos.roomName != spawn.pos.roomName) {
    pathUtil.setMem(creep.memory, creep.pos, spawn.pos, {cache: false});
  }
  creep.memory.role = ROLE;
  creep.memory.spawn = spawn.id;
  return true;
},
run: function(creep) {
  if(creep.memory.exitPath) return pathUtil.macroMove(creep);
  const spawn = Game.getObjectById(creep.memory.spawn);
  if(!spawn) {
    console.log(`${creep.name} has no recycle dest, giving up`);
    creep.say("lost");
  }
  if(!creep.pos.isNearTo(spawn)) {
    creep.moveTo(spawn)
  } else {
    spawn.recycleCreep(creep);
  }
}
};
