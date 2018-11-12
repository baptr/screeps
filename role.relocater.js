// dummy role that moves between rooms before switching to a new role
// example:
// Game.spawns.Spawn2.spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], 'relo-builder', {memory: relocator.setMem({}, 'W4N8', 'builder')})
module.exports = {
    setMem: function(mem, roomName, nextRole) {
        mem.role = 'relocater';
        mem.reloRoom = roomName;
        mem.reloNextRole = nextRole;
        return mem;
    },
    run: function(creep) {
        var tgt = creep.memory.reloRoom;
        if(!tgt) {
            console.log(`${creep.name} has invalid target room ${tgt}`);
            return;
        }
        creep.moveTo(new RoomPosition(25,25,tgt));
        
        if(creep.room.name == tgt) {
            var newRole = creep.memory.reloNextRole;
            creep.say('Now '+newRole)
            creep.memory.role = newRole;
            delete creep.memory.reloRoom;
            delete creep.memory.reloNextRole;
            delete creep.memory.reloExit;
            return;
        }
    }
};