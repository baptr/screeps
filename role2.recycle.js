const ROLE = 'recycle';
module.exports = {
ROLE,
convert: function(creep) {
    var spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
    if(!spawn) {
        console.log(`No where for ${creep.name} to recycle`);
        return false;
    }
    creep.memory.role = ROLE;
    creep.memory.spawn = spawn.id;
    return true;
},
run: function(creep) {
    var spawn = Game.getObjectById(creep.memory.spawn);
    if(!spawn) {
        console.log(`${creep.name} has no recycle dest, giving up`);
        creep.suicide();
    }
    if(!creep.pos.isNearTo(spawn)) {
        creep.moveTo(spawn)
    } else {
        spawn.recycleCreep(creep);
    }
}
};