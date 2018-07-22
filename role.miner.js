module.exports = {
    spawnCondition: function(room) {
        var minerals = room.find(FIND_MINERALS);
        return _.sum(_.map(minerals, 'mineralAmount'));
    },
    run: function(creep) {
        if(creep.memory.fallback) { return false; } // TODO(baptr): Some way to return to this?
        
        if(creep.memory.filling && _.sum(creep.carry) == creep.carryCapacity) {
            creep.memory.filling = false;
        } else if(!creep.memory.filling && _.sum(creep.carry) == 0) {
            creep.memory.filling = true;
        }
        
        if(creep.memory.filling) {
            var src = Game.getObjectById(creep.memory.source);
            var ret = creep.harvest(src);
            switch(ret) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(src);
                break;
            case ERR_NOT_ENOUGH_RESOURCES:
                delete creep.memory.source;
                creep.memory.fallback = true;
                return false;
                break;
            case ERR_TIRED:
                // TODO(baptr): Wait for cooldown?
                break;
            case ERR_BUSY:
                // Not sure why this triggers early.
                break;
            case OK:
                // TODO(baptr): Accounting.
                break;
            default:
                console.log(`Unrecognized ${creep.name} harvest failure: ${ret}`);
            }
        } else {
            var dest = Game.getObjectById(creep.memory.store);
            for(t in creep.carry) {
                // TODO(baptr): can you even transfer multiple in one tick?
                if(creep.transfer(dest, t) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(dest);
                    break;
                }
            }
        }
    }
};