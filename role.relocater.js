// dummy role that moves between rooms before switching to a new role
// example:
// Game.spawns.Spawn2.spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], 'relo-builder', {memory: relocator.setMem({}, 'W4N8', 'builder')})
module.exports = {
    spawn: function(spawn, body, roomName, nextRole, extMem = {}) {
        
    },
    setMem: function(mem, roomName, nextRole) {
        mem.role = 'relocater';
        mem.reloRoom = roomName;
        mem.reloNextRole = nextRole;
        return mem;
    },
    run: function(creep) {
        var tgt = creep.memory.reloRoom;
        if(creep.room.name == tgt) {
            creep.moveTo(creep.room.controller); // get away from the exit
            var newRole = creep.memory.reloNextRole;
            creep.say('Now '+newRole)
            creep.memory.role = newRole;
            delete creep.memory.reloRoom;
            delete creep.memory.reloNextRole;
            delete creep.memory.reloExit;
            return;
        }
        var exit = creep.memory.reloExit;
        if(!exit || exit.roomName != creep.room.name) {
            var dir = creep.room.findExitTo(tgt);
            exit = creep.pos.findClosestByPath(dir);
            if(!exit) {
                creep.say(`No exit ${tgt}`);
                return;
            }
            creep.memory.reloExit = exit;
        }
        creep.moveTo(exit.x, exit.y);
    }
};