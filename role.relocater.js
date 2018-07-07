// dummy role that moves between rooms before switching to a new role
module.exports = {
    setMem: function(mem, room, nextRole) {
        mem.role = 'relocater';
        mem.reloRoom = room;
        mem.reloNextRole = nextRole;
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
            delete creep.memory.roleExit;
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