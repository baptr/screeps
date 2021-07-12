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
  creep.memory.role = ROLE;
  creep.memory.spawn = spawn.id;
  return true;
},
run: function(creep) {
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
