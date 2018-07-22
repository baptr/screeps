module.exports = {
    run: function(creep) {
        var res = creep.memory.resource;
        var from = Game.getObjectById(creep.memory.from);
        var to = Game.getObjectById(creep.memory.to);
        if(res && from && to) {
            if(creep.memory.filling) {
                var ret;
                if(from instanceof Structure) {
                    ret = creep.withdraw(from, res);
                } else if(from instanceof Source) {
                    ret = creep.harvest(from);
                    // XXX doesn't return full.
                    // TODO(baptr): Doesn't handle container harvesters.
                    if(ret == OK && _.sum(creep.carry) == creep.carryCapacity) {
                        ret = ERR_FULL;
                    }
                } else if(from instanceof Resource) {
                    ret = creep.pickup(from);
                }
                switch(ret) {
                case ERR_NOT_IN_RANGE:
                    creep.moveTo(from);
                    break;
                case ERR_FULL:
                    creep.memory.filling = false;
                    break;
                }
            } else {
                var ret;
                if(to instanceof StructureController) {
                    ret = creep.upgradeController(to);
                } else if(to instanceof Structure) {
                    // TODO(baptr): Try repair first??
                    ret = creep.transfer(to, res);
                }
                switch(ret) {
                case ERR_NOT_IN_RANGE:
                    creep.moveTo(to);
                    break;
                case ERR_FULL:
                    // TODO(baptr): Maybe go refill before waiting?
                    creep.say('Dest full');
                    break;
                case ERR_NOT_ENOUGH_RESOURCES:
                    creep.memory.filling = true;
                    break;
                }
            }
        } else if(from && from instanceof Source) {
            if(creep.harvest(from) == ERR_NOT_IN_RANGE) {
                creep.moveTo(from);
            }
        }
    }
};