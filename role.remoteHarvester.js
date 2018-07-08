module.exports = {
    // XXX new feels dumb so far
    new: function(room, source) {
        return {
            room: room,
            source: source,
            filling: true,
        }
    },
    run: function(creep) {
        if(creep.ticksToLive == 1) {
            console.log(creep.name + ' lifetime achievements: '+creep.memory.delivered);
        }
        if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
            creep.say('Delivery');
            creep.memory.filling = false;
        }
        if(!creep.memory.filling && creep.carry.energy == 0) {
            creep.say('Restocking');
            creep.memory.filling = true;
        }
        
        if(creep.memory.filling) {
            var source = Game.getObjectById(creep.memory.source);
            if(source) {
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    // TODO(baptr): More intentional movement.
                    creep.moveTo(source);
                }
                return true;
            }
            // TODO(baptr): Store this...
            var exitDir = creep.room.findExitTo(creep.memory.room);
            if(exitDir < 0) {
                console.log(creep.name+': Unable to find exit to '+creep.memory.room+' ('+exitDir+')');
                return false;
            }
            var exit = creep.pos.findClosestByPath(exitDir);
            creep.moveTo(exit);
        } else {
            var dest = Game.getObjectById(creep.memory.dest);
            if(!dest || dest.energy == dest.energyCapacity) {
                var spawn = Game.spawns['Spawn1'];
                if(creep.room != spawn.room) {
                    // TODO(baptr): Make this less expensive.
                    var t = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: (s) =>
                        s.structureType == STRUCTURE_TOWER && s.energy < 450
                    });
                    if(t) {
                        if(creep.transfer(t, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(t);
                            return true;
                        }
                    }
                    // XXX suboptimal if the extensions aren't in the same area
                    // as the spawn.
                    creep.moveTo(spawn);
                    return true;
                }
                var targets = spawn.room.find(FIND_MY_STRUCTURES, {
                    filter: (e) => e.structureType == STRUCTURE_EXTENSION && e.energy < e.energyCapacity
                });
                dest = creep.pos.findClosestByPath(targets)
                if(!dest) {
                    creep.say('Waiting');
                    // TODO(baptr): Cleaner fallback.
                    switch(creep.upgradeController(spawn.room.controller)) {
                    case ERR_NOT_IN_RANGE:
                        creep.moveTo(spawn.room.controller);
                        break
                    case OK:
                        creep.memory.delivered += Math.min(creep.carry.energy, creep.getActiveBodyparts(WORK));
                        break;
                    }
                    return false;
                }
                creep.memory.dest = dest.id;
            }
            var ret = creep.transfer(dest, RESOURCE_ENERGY);
            if(ret == ERR_NOT_IN_RANGE) {
                creep.moveTo(dest);
            } else if(ret == OK) {
                creep.memory.delivered += Math.min(creep.carry.energy, dest.energyCapacity-dest.energy);
            }
            if(creep.transfer(dest, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(dest);
            }
        }
    }
};