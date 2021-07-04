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

const DEPOSIT_ONLY_STORES = [
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_TOWER,
];

function findSrc(creep, type=RESOURCE_ENERGY, resMin=25) {
    var src = Game.getObjectById(creep.memory.source);
    if(resAvail(src, type) > resMin) {
        return src;
    }
    
    // find closest of res+store structs
    const structs = creep.room.find(FIND_STRUCTURES, {
        filter: s => (s.store || {})[type] > resMin && !DEPOSIT_ONLY_STORES.includes(s.structureType)
    });
    const res = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType == type && r.amount > resMin
    });
    const bodies = creep.room.find(FIND_TOMBSTONES, {filter: t => t.store[type] > resMin});
    src = creep.pos.findClosestByPath(structs.concat(res).concat(bodies));
    if(src) {
        creep.memory.source = src.id;
        return src;
    }

    // TODO: Consider if it's acceptable to raid the spawn energy.

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

const CTRL_UPGRADE_RANGE = 3;
function roomCtrlStores(room) {
    return room.controller.pos.findInRange(FIND_STRUCTURES, CTRL_UPGRADE_RANGE+1, {
        filter: s => s.store
    });
}

function roomResource(room, type=RESOURCE_ENERGY) {
  let out = 0;
  for(const s of room.find(FIND_STRUCTURES)) {
    if(s.store) out += s.store[type];
  }
  for(const r of room.find(FIND_DROPPED_RESOURCES)) {
    if(r.resourceType == type) out += r.amount;
  }
  return out
}

module.exports = {
    harvest,
    findSrc,
    resAvail,
    roomCtrlStores,
    roomResource,
};
