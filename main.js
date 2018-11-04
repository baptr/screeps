const LOCALS = require('local');

const ROLES = ['harvester', 'remoteHarvester', 'upgrader', 'builder', 'repairer', 'defender', 'claimer', 'relocater', 'miner', 'linkTransfer', 'bob'];
const ROLE2S = ['bootstrapper', 'dropHarvester', 'miner', 'combatant', 'dismantler', 'carrier', 'scout'];
var role = {};
_.forEach(ROLES, r => {
    role[r] = require('role.'+r);
})
_.forEach(ROLE2S, r => {
    let m = require('role2.'+r);
    if(m.ROLE) {
        r = m.ROLE;
    }
    if(role[r]) {
        console.log("Duplicate role: "+r);
        role[r+"_2"] = m;
    } else {
        role[r] = m;
    }
})

const PLANNERS = ['claim', 'lab', 'attack', 'room'];
var plan = {};
_.forEach(PLANNERS, p => {plan[p] = require('plan.'+p)});

const STRUCTS = ['tower'];
var struct = {};
_.forEach(STRUCTS, s => {struct[s] = require('struct.'+s)});

const UTILS = ['creep', 'pathing', 'stats', 'splay'];
var util = {};
_.forEach(UTILS, u => {util[u] = require('util.'+u)});

const profiler = require('screeps-profiler');
/*
profiler.enable();
_.forEach(role, (m, r) => profiler.registerObject(m, 'role.'+r));
_.forEach(plan, (m, p) => profiler.registerObject(m, 'plan.'+p));
_.forEach(struct, (m, s) => profiler.registerObject(m, 'struct.'+s));
_.forEach(util, (m, u) => profiler.registerObject(m, 'util.'+u));
*/

console.log('Reloading');

function buildingSay(struct, text) {
    struct.room.visual.text(
        text,
        struct.pos.x + 1, 
        struct.pos.y, 
        {align: 'left', opacity: 0.8});
}

const main = {
runPlanners: function() {
    _.forEach(LOCALS.ROOMS, r => {
        plan.room.run(Game.rooms[r]);
    })

    plan.lab.test();
    plan.claim.test();
    if(LOCALS.ATTACK) {
      plan.attack.test();
    }
},
cleanup: function() {
    var lost = [];
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            var plaque = name;
            var achievement = Memory.creeps[name].delivered;
            if(achievement) {
                plaque += ' (delivered '+achievement+')';
            }
            lost.push(plaque)
            delete Memory.creeps[name];
        }
    }
    if(lost.length) { console.log('Lost '+lost); }
},
runCreeps: function() {
    _.forEach(Game.creeps, creep => {
        // TODO(baptr): Some day I'm going to want to do something while some
        // role is still spawning, but until then...
        if(creep.spawning) return;
        // TODO(baptr): Stop doing fallbacks here so there can be fewer special cases.
        let roleName = creep.memory.role;
        switch(roleName) {
        case 'harvester':
            if(role.harvester.run(creep) === false) {
                role.repairer.run(creep);
            }
            break;
        case 'builder':
            if(role.builder.run(creep) === false) {
                if(role.repairer.run(creep) === false) {
                    if(role.harvester.run(creep) === false) {
                        role.upgrader.run(creep);
                    };
                };
            };
            break;
        case 'miner':
            if(role.miner.run(creep) === false) {
                role.repairer.run(creep);
            }
            break;
        default:
            var r = role[roleName];
            if(r) {
                r.run(creep);
            } else {
                console.log(`${creep.name} has unknown role (${roleName})`);
            }
        }
    });
},
runStructs: function() {
    _.forEach(Game.structures, s => {
        let m = struct[s.structureType];
        if(m) m.run(s);
    });
}
}
profiler.registerObject(main, 'main');

module.exports.loop = () => profiler.wrap(() => {
    main.runPlanners();
    
    if(Game.time % 20 == 0) {
        // Periodic cleanup
        main.cleanup();
    }
    
    main.runCreeps();
    main.runStructs();
    
    // Segmented stats are read every 15s.
    Memory.cpu_stats += Game.cpu.getUsed();
    if(Game.time % 50 == 0) {
        const stats = util.stats.run(Memory.cpu_stats);
        // Memory.stats = stats;
        RawMemory.segments[99] = JSON.stringify(stats);
    }
})
