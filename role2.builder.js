const util = require('util.creep');
const resUtil = require('util.resources');
const BodyBuilder = require('util.bodybuilder');
const bootstrapper = require('role2.bootstrapper');

const MIN_BODY = [WORK, CARRY, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

const ROLE = 'builder'

function findTarget(creep) {
    var target = Game.getObjectById(creep.memory.buildTarget);
    if(target && target.progress < target.progressTotal) {
        return target;
    }
    const room = creep.room;
    var sites = room.find(FIND_CONSTRUCTION_SITES);
    // prioritize finishing started construction first
    var startedSites = _.filter(sites, s => s.progress > 0);
    if(startedSites.length) {
        sites = startedSites;
    }
    target = creep.pos.findClosestByPath(sites);
    if(target) {
        creep.memory.buildTarget = target.id;
        return target
    }
    
    var structs = room.find(FIND_STRUCTURES);
    _.sortBy(structs, s => s.hits/s.hitsMax);
    target = structs[0]
    if(target && target.hits < target.hitsMax) {
        creep.memory.buildTarget = target.id;
        return target;
    }
    return null;
}

// TODO base on actual body expenditure
const SPAWN_NEED_THRESHOLD = 3000;

module.exports = {
ROLE,
spawnCondition: function(room, numExisting) {
    if(room.energyAvailable < 1000 || room.energyAvailable < room.energyCapacityAvailable*0.5) {
        return false;
    }
    var buildNeed = _.sum(_.map(room.find(FIND_MY_CONSTRUCTION_SITES),
                                s => s.progressTotal - s.progress));
    var repairNeed = _.sum(_.map(room.find(FIND_MY_STRUCTURES), s => {
        var dmg = s.hitsMax - s.hits;
        if(s.structureType == STRUCTURE_CONTAINER) {
            // Containers rot fast and aren't high priority, so underplay their
            // damage.
            dmg /= 1000;
        }
        return dmg;
    }));
    const thresh = SPAWN_NEED_THRESHOLD * (1+numExisting);
    if(buildNeed + repairNeed < thresh) {
        return false;
    }
    return true;
},
// mkBody is exported for plan.claim
mkBody: function(energyAvailable) {
    var builder = new BodyBuilder(MIN_BODY, energyAvailable);
    
    builder.extend([WORK, MOVE], limit=4); // up to 1/2 of a carry per tick, costing 750 eng
    builder.extend([CARRY, MOVE], limit=9); // up to 10 CARRY (500 eng cap) @ 1750 total eng cost
    
    builder.extend([WORK, MOVE], limit=5); // build a full 50 eng/tick
    builder.extend([CARRY, MOVE]);
    // max at 10 work, 15 carry, 25 move. 750 capacity, 15 tick build
    
    if(builder.count(WORK) < 2) return null;
    
    return builder.sort();
},
spawn: function(spawn) {
    const energyAvailable = spawn.room.energyAvailable;
    if(energyAvailable < MIN_COST || spawn.spawning) { return false; }
    
    const body = module.exports.mkBody(energyAvailable);
    if(!body) return false;
    const name = `${ROLE}-${spawn.room.name}-${Game.time}`;
    var ret = spawn.spawnCreep(body, name, {
        memory: {
            role: ROLE,
            cost: util.bodyCost(body),
        },
    });
    if(ret != OK) {
        console.log(`Failed to spawn ${name}: ${ret}`);
    }
    return ret;
},
run: function(creep) {
    if(!creep.memory.filling && creep.carry.energy == 0) {
        creep.memory.filling = true;
    } else if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
        creep.memory.filling = false;
    }

    if(!creep.memory.filling) {
        const target = findTarget(creep);
        if(!target) return bootstrapper.run(creep); // fill?
        
        var ret;
        var effort;
        if(target instanceof ConstructionSite) {
            ret = creep.build(target);
            const delivery = creep.getActiveBodyparts(WORK)*BUILD_POWER;
            effort = Math.min(delivery, target.progressTotal-target.progress);
        } else if(target instanceof Structure) {
            ret = creep.repair(target);
            const delivery = creep.getActiveBodyparts(WORK)*REPAIR_POWER;
            effort = Math.min(delivery, target.hitsMax-target.hits);
        }
        switch(ret) {
        case ERR_NOT_ENOUGH_RESOURCES:
            // TODO(baptr): Clean this up if it can't happen.
            console.log(`${creep.name} hit NOT_ENOUGH_RESOURCES trying to deliver`);
            creep.memory.filling = true;
            creep.moveTo(Game.getObjectById(creep.memory.source));
            break;
        case ERR_NOT_IN_RANGE:
            creep.moveTo(target);
            break;
        case OK:
            creep.memory.delivered += effort
            break;
        }
    } else {
        const source = resUtil.findSrc(creep);
        if(!source) {
            if(creep.carry.energy > 0) {
                creep.memory.filling = false;
            }
            return;
        }
        
        var ret = resUtil.harvest(creep, source);
        switch(ret) {
        case OK:
            break;
        case ERR_NOT_IN_RANGE:
            if(creep.moveTo(source) == ERR_NO_PATH) {
                creep.memory.blocked++;
                if(creep.memory.blocked > 5) {
                    console.log(`${creep.name} unable to reach ${source}`);
                    delete creep.memory.source;
                }
                return;
            }
            // TODO: Set this less often?
            creep.memory.blocked = 0;
            break;
        }
    }
}
};
