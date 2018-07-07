module.exports = {
    run: function(creep) {
        if(creep.memory.filling && _.sum(creep.carry) == creep.carryCapacity) {
            creep.memory.filling = false;
        } else if(!creep.memory.filling && _.sum(creep.carry) == 0) {
            creep.memory.filling = true;
        }
        
        if(creep.memory.filling) {
            var src = Game.getObjectById(creep.memory.source);
            // TODO(baptr): Wait on cooldown?
            var ret = creep.harvest(src);
            if(creep.harvest(src) == ERR_NOT_IN_RANGE) {
                creep.moveTo(src);
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