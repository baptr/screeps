const util = require('util.creep');
const resUtil = require('util.resources');
const BodyBuilder = require('util.bodybuilder');
const bootstrapper = require('role2.bootstrapper');

const MIN_BODY = [WORK, CARRY, MOVE, MOVE];
const MIN_COST = util.bodyCost(MIN_BODY);

const ROLE = 'builder'

// TODO(baptr): builders should stand off the road while building
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
    const damagedStructs = room.find(FIND_STRUCTURES, {filter: s => s.hits < s.hitsMax});
    const fresh = creep.pos.findClosestByRange(damagedStructs.filter(s => s.hits == 1));
    if(fresh && creep.pos.getRangeTo(fresh) <= 3) {
        trace(creep, `repairing new wall/rampart ${fresh}`);
        creep.memory.buildTarget = fresh.id;
        return fresh;
    }
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
    
    var structs = _.sortBy(damagedStructs, s => {
        switch(s.structureType) {
        case STRUCTURE_RAMPART:
        case STRUCTURE_WALL:
            return s.hits/300e3; // Normalize walls and ramparts to keep defenses flat
        default:
            return s.hits/s.hitsMax;
        }
    });
    target = structs[0]; // XXX offset by builder index or multiple chase eachother
    if(target) {
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
        switch(s.structureType) {
        // Containers rot fast and aren't high priority, so underplay their
        // damage.
        case STRUCTURE_CONTAINER:
            return dmg / 200;
        case STRUCTURE_ROAD:
            return dmg / 100;
        // Walls and ramparts are huge, and ramparts rot pretty fast too, so
        // underplay them significantly.
        // TODO(baptr): Large wall banks are still going to blow this out.
        case STRUCTURE_RAMPART:
        case STRUCTURE_WALL:
            return 50 * (1 - s.hits/s.hitsMax);
        default:
            return dmg;
        }
    }));
    var body = module.exports.mkBody(room.energyAvailable);
    if(!body) return false;
    
    // TODO(baptr): Some better threshold to save up?
    const thresh = util.bodyCost(body) * 2 * (1+numExisting);
    if(buildNeed/4 + repairNeed < thresh) return false;
    console.log(`${room.name} builder need: ${buildNeed} + ${repairNeed} > ${thresh}`);
    return true;
},
// mkBody is exported for plan.claim
mkBody: function(energyAvailable) {
    var builder = new BodyBuilder(MIN_BODY, energyAvailable);
    
    builder.extend([WORK, MOVE, CARRY, MOVE], limit=3);
    builder.extend([CARRY, MOVE], limit=2);
    builder.extend([WORK, MOVE], limit=2);
    
    builder.extend([CARRY, MOVE], limit=5);
    builder.extend([WORK, MOVE], limit=5);
    
    builder.extend([CARRY, MOVE]);
    builder.extend([MOVE]);
    
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
        if(Game.getObjectById(creep.memory.buildTarget) instanceof Structure) {
            delete creep.memory.buildTarget;
        }
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
                // TODO: Find a better way not to stay latched on to a source
                // that's blocked by dropHarvesters.
                if(creep.memory.blocked > 2) {
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
