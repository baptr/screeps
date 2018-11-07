const ROLE = 'scout'
module.exports = {
ROLE,
spawn: function(spawner, room) {
    return spawner.spawnCreep([TOUGH, MOVE, TOUGH, MOVE], `scout-${room}-${Game.time}`, {
        memory: {
            target: room,
            role: ROLE
        }
    });
},
run: function(creep) {
    const target = creep.memory.target;
    if(!target) {
        console.log("nothing to do, good day!")
        creep.suicide();
    }
    creep.moveTo(new RoomPosition(25, 25, target), {visualizePathStyle: {}, reusePath: 100});
}
};