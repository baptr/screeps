var relo = require('role.relocater');
var util = require('util');

module.exports = {
    controllerLink: '5b4120c35676c340a95ea8f9',
    pocketSrc: 'fad207732c08b34',
    spawn: function(spawn, source, sink) {
        // Don't need to move with fully carrys, but should probably buffer some energy?
        // Mostly work.
        // Only really useful in pairs, so don't spend everything all at once??
        var availableEng = spawn.room.energyAvailable;
        var body = [MOVE, CARRY, CARRY, WORK];
        availableEng -= util.bodyCost(body);
        // Try 2:1 WORK:MOVE to start, since they need to travel fairly far for
        // setup?
        const workUnit = [WORK, WORK, WORK, CARRY, MOVE, MOVE];
        const workCost = util.bodyCost(workUnit);
        while(availableEng > workCost) {
            body = body.concat(workUnit);
            availableEng -= workCost;
        }
        
        var dest = sink;
        if(sink.structureType == STRUCTURE_LINK) {
            // Find the closest link to the source to drop energy in directly.
            dest = source.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK});
        } else {
            delete sink;
        }
        
        var memory = {source: source.id, dest: dest.id, sink: sink.id};
        relo.setMem(memory, source.room.name, 'linkTransfer');
        var name = 'linkTransfer_' + source.room.name + '_' + Game.time;
        spawn.spawnCreep(body, name, {memory: memory});
    },
    run: function(creep) {
        if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
            creep.memory.filling = false;
        } else if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.memory.filling = true;
        }
        
        if(!creep.memory.filling) {
            var dest = Game.getObjectById(creep.memory.dest);
            var ret = creep.transfer(dest, RESOURCE_ENERGY);
            switch(ret) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(dest);
                break;
            case OK:
                break;
            case ERR_NOT_ENOUGH_ENERGY:
                creep.memory.filling = true;
                break;
            case ERR_FULL:
                // TODO(baptr): Some other fallback?
                // Let it transfer
                break;
            default:
                console.log(`${creep.name} unrecognized transfer failure to ${dest}: ${ret}`);
            }
            if(!dest) { return false; }
            if(dest.structureType == STRUCTURE_LINK && dest.energy == dest.energyCapacity) {
                var sink = Game.getObjectById(creep.memory.sink);
                dest.transferEnergy(sink);
            }
        } else {
            var src = Game.getObjectById(creep.memory.source);
            if(creep.harvest(src) == ERR_NOT_IN_RANGE) {
                creep.moveTo(src);
            }
        }
    }
};