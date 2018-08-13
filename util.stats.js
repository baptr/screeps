const creepUtil = require('util.creep');

function roomStats(room) {
    var out = {};
    
    const structs = room.find(FIND_STRUCTURES);
    const creeps = room.find(FIND_CREEPS);
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    const sources = room.find(FIND_SOURCES);
    const resources = room.find(FIND_DROPPED_RESOURCES);
    
    var structStats = {
        count: 0,
        hits: 0,
        hitsMax: 0,
        totalCost: 0,
        storage: 0,
    };
    var energyStats = {
        capacity: room.energyCapacityAvailable,
        spawn: room.energyAvailable,
        pending: _.sum(_.map(sources, s => s.energy)),
        stored: 0,
        dropped: _.sum(_.map(resources, r => {
            if(r.resourceType == RESOURCE_ENERGY) return r.amount;
            return 0;
        })),
    };
    _.forEach(structs, s => {
        structStats.count++;
        structStats.hits += s.hits || 0;
        structStats.hitsMax += s.hitsMax || 0;
        structStats.totalCost += CONSTRUCTION_COST[s.structureType] || 0;
        structStats.storage += _.sum(s.store) || 0;
        if(s instanceof StructureLink) {
            energyStats.stored += s.energy;
        } else {
            energyStats.stored += (s.store || {}).energy || 0;
        }
    });
    _.forEach(sites, s => {
        structStats.totalCost += s.progress;
    });
    out.structStats = structStats;
    out.energyStats = energyStats;
    
    var creepStats = {
        count: 0,
        hits: 0,
        hitsMax: 0,
        bodyCost: 0,
    };
    _.forEach(creeps, c => {
        creepStats.count++;
        creepStats.hits += c.hits || 0;
        creepStats.hitsMax += c.hitsMax || 0;
        creepStats.bodyCost += creepUtil.bodyCost(c.body) || 0;
    });
    out.creepStats = creepStats;
    
    const ctrl = room.controller;
    if(ctrl) {
        out.ctrl = {
            level: ctrl.level,
            totalProgress: _.sum(_.filter(CONTROLLER_LEVELS, (c, v) => v < ctrl.level)) + ctrl.progress,
            // TODO(baptr): Is there any way to count contributions to GCL??
        };
    }
    
    return out;
}

function globalStats() {
    var out = {
        gcl: Game.gcl,
        tick: Game.time,
        roomCount: 0,
        memSize: RawMemory.get().length,
    };
    // TODO(baptr): Somehow keep running CPU usage to export avg/min/max?
    return out;
}

module.exports = {
run: function(cumCPU) {
    var out = globalStats();
    out.rooms = {};
    _.forEach(Game.rooms, r => {
        if(!r.controller/* || !r.controller.my*/) return; // Include anyway??
        out.rooms[r.name] = roomStats(r);
        if(r.controller && r.controller.my) out.roomCount++;
    })
    out.cumulativeCPU = cumCPU;
    out.tickCPU = Game.cpu.getUsed();
    return out;
},
roomStats: roomStats,
};