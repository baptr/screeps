function resAvail(src, type=RESOURCE_ENERGY) {
    if(!src) return 0;
    if(src.store) {
        return src.store[type] || 0;
    }
    if(src instanceof Source) {
        return src.energy;
    }
    if(src instanceof Resource) {
        if(src.resourceType == type) return src.amount;
        return 0;
    }
    return 0;
}

function harvest(creep, src, type=RESOURCE_ENERGY) {
    if(!src) return ERR_INVALID_ARGS;
    if(src.store) {
        return creep.withdraw(src, type);
    }
    if(src.amount) {
        return creep.pickup(src);
    }
    return creep.harvest(src);
}

function findSrc(creep, type=RESOURCE_ENERGY, resMin=25) {
    var src = Game.getObjectById(creep.memory.source);
    if(resAvail(src, type) > resMin) {
        return src;
    }
    
    // find closest of res+store structs
    var structs = creep.room.find(FIND_STRUCTURES, {
        filter: s => (s.store || {})[type] > resMin
    });
    var res = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType == type && r.amount > resMin
    });
    src = creep.pos.findClosestByPath(structs.concat(res));
    if(src) {
        creep.memory.source = src.id;
        return src;
    }
    // fall back on trying to harvest
    if(type == RESOURCE_ENERGY && creep.getActiveBodyparts(WORK)) {
        // memoize or not?
        src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if(src) {
            creep.memory.source = src.id;
            return src;
        }
    }
    return null;
}

module.exports = {
    harvest,
    findSrc,
    resAvail,
};
