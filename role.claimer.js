module.exports = {
    spawn: function(spawn, room) {
        var body = [TOUGH, TOUGH, MOVE, MOVE, CLAIM, MOVE];
        var mem = {role: 'claimer', targetRoom: room};
        if(spawn.room.findExitTo(room) < 0) {
            console.log(`Unable to spawn claimer for room ${room}, no exit`);
            return false;
        }
        spawn.spawnCreep(body, 'claimer_'+room, {memory: mem});
    },
    run: function(creep) {
        var targetRoom = creep.memory.targetRoom;
        if(creep.room.name != targetRoom) {
            var dir = creep.room.findExitTo(targetRoom);
            var exit = creep.pos.findClosestByPath(dir);
            creep.moveTo(exit);
        } else {
            var ctrl = creep.room.controller;
            if(ctrl.my) {
                // TODO(baptr): Turn in to an upgrader?
                
            } else if(creep.claimController(ctrl) == ERR_NOT_IN_RANGE) {
                creep.moveTo(ctrl);
            }
        }
    }
};