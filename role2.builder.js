const util = require('util.creep');
const resUtil = require('util.resources');
const BodyBuilder = require('util.bodybuilder');
const bootstrapper = require('role2.bootstrapper');

const MIN_BODY = [WORK, CARRY, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

const ROLE = 'builder'

function trace(creep, msg, splay=1) {
    if(!creep.memory.trace) return;
    if(Game.time % splay != 0) return;
    console.log(`${creep.name}: ${msg}`);
}

function findTarget(creep) {
    var target = Game.getObjectById(creep.memory.buildTarget);
    if(target) {
        if(target.progress < target.progressTotal) {
            trace(creep, `using existing build target ${target}`, splay=10);
            return target;
        }
        if(target.hits < target.hitsMax) {
            trace(creep, `using existing repair target ${target}`, splay=10);
            return target;
        }
    }
    const room = creep.room;
    var sites = room.find(FIND_MY_CONSTRUCTION_SITES);
    // prioritize finishing started construction first
    var startedSites = _.filter(sites, s => s.progress > 0);
    if(startedSites.length) {
        trace(creep, `checking started construction sites`);
        sites = startedSites;
    }
    target = creep.pos.findClosestByPath(sites);
    if(target) {
        trace(creep, `using new construction site ${target}`);
        creep.memory.buildTarget = target.id;
        return target
    }
    
    var structs = _.sortBy(room.find(FIND_STRUCTURES), s => s.hits/s.hitsMax);
    target = structs[0]
    if(target && target.hits < target.hitsMax) {
        trace(creep, `repairing ${target}`);
        creep.memory.buildTarget = target.id;
        return target;
    }
    trace(creep, `nothing to build`);
    return null;
}

module.exports = {
ROLE,
spawnCondition: function(room, numExisting) {
    if(room.energyAvailable < 500 || room.energyAvailable < room.energyCapacityAvailable*0.5) {
        return false;
    }
    var buildNeed = _.sum(_.map(room.find(FIND_MY_CONSTRUCTION_SITES),
                                s => s.progressTotal - s.progress));
    var repairNeed = _.sum(_.map(room.find(FIND_STRUCTURES), s => {
        var dmg = s.hitsMax - s.hits;
        if(s.structureType == STRUCTURE_CONTAINER) {
            // Containers rot fast and aren't high priority, so underplay their
            // damage.
            dmg /= 200;
        }
        return dmg;
    }));
    var body = module.exports.mkBody(room.energyAvailable);
    if(!body) return false;
    
    // TODO(baptr): Some better threshold to save up?
    const thresh = util.bodyCost(body) * 2 * (1+numExisting);
    if(buildNeed + repairNeed < thresh) return false;
    console.log(`${room.name} builder need: ${buildNeed} + ${repairNeed} < ${thresh}`);
    
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
        delete creep.memory.source;
        creep.memory.filling = true;
    } else if(creep.memory.filling && creep.carry.energy == creep.carryCapacity) {
        creep.memory.filling = false;
    }

    if(!creep.memory.filling) {
        const target = findTarget(creep);
        if(!target) {
            trace(creep, 'falling back as bootstrapper');
            return bootstrapper.run(creep); // fill?
        }
        
        var ret;
        var effort;
        if(target instanceof ConstructionSite) {
            ret = creep.build(target);
            const delivery = creep.getActiveBodyparts(WORK);
            effort = Math.min(delivery, Math.ceil((target.progressTotal-target.progress)/BUILD_POWER));
        } else if(target instanceof Structure) {
            ret = creep.repair(target);
            const delivery = creep.getActiveBodyparts(WORK);
            effort = Math.min(delivery, Math.ceil((target.hitsMax-target.hits)/REPAIR_POWER));
        }
        switch(ret) {
        case ERR_NOT_IN_RANGE:
            creep.moveTo(target);
            break;
        case OK:
            creep.memory.delivered += effort
            break;
        }
    } else {
        const source = resUtil.findSrc(creep);
        if(!source) { // TODO(baptr): or too far away...
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
            if(creep.carry.energy > 100) {
                trace(creep, `checking range to ${source}`);
                var path = creep.pos.findPathTo(source.pos, {maxOps: 100, maxRooms: 1, range: 1});
                if(path.length > 20) {
                    delete creep.memory.source;
                    creep.memory.filling = false;
                }
            }
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
