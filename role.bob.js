module.exports = {
    spawn: function(spawn, res, src, dest) {
        if(src == dest) return false;
        return spawn.spawnCreep(
            [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY].concat(Array(10).fill(MOVE)),
            `bob-${spawn.name}-${Game.time}`, {memory: {
                role: "bob",
                resource: res,
                from: src,
                to: dest,
                filling: true,
            }});
    },
    run: function(creep) {
        var res = creep.memory.resource;
        var to = Game.getObjectById(creep.memory.to);
        /*
        if(to && creep.carry[res] > 0) {
            if(creep.transfer(to, res) == ERR_NOT_IN_RANGE) creep.moveTo(to);
            return
        }
        var ground = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {filter: r => r.resourceType == res});
        if(ground) {
            if(creep.pickup(ground) == ERR_NOT_IN_RANGE) creep.moveTo(ground);
            return;
        }
        return
        */
        var from = Game.getObjectById(creep.memory.from);
        if(res && from) {
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
                case OK: break;
                default:
                    // if(Game.time % 10 == 0) console.log("bob failed", ret);
                }
            } else {
                if(!to) {
                    creep.drop(res);
                }
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