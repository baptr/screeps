const ROLES = ['harvester', 'remoteHarvester', 'upgrader', 'builder', 'repairer', 'defender', 'claimer', 'relocater', 'miner', 'linkTransfer', 'bob'];
const ROLE2S = ['bootstrapper', 'dropHarvester', 'miner', 'combatant', 'dismantler', 'carrier'];
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
//profiler.enable();
_.forEach(role, (m, r) => profiler.registerObject(m, 'role.'+r));
_.forEach(plan, (m, p) => profiler.registerObject(m, 'plan.'+p));
_.forEach(struct, (m, s) => profiler.registerObject(m, 'struct.'+s));
_.forEach(util, (m, u) => profiler.registerObject(m, 'util.'+u));


const SPAWN_NAME = 'Spawn1';
const BASE_NAME = Game.spawns[SPAWN_NAME].room.name; // 'W4N9';
const DUMP_COSTS = false;
console.log('Reloading');

function addMOVE(body) {
    // TODO(baptr): Filter for only non-MOVE parts.
    return body.concat(Array(body.length).fill(MOVE));
}

var colonyTargets = [
    // TODO(baptr): Auto-downscale these for initial setup.
    {role: "harvester", body: addMOVE([WORK, CARRY]), target: 1, memory: {source: "e1620773914ad5a"}},
    {role: "remoteHarvester", subtype: "_W5N9", body: addMOVE([WORK, WORK, CARRY, CARRY, CARRY, CARRY]), target: 2, 
        memory: role.remoteHarvester.new("W5N9", 'f43107732c09317')},
    {role: "harvester", subtype: "_big", body: addMOVE([WORK, WORK, WORK, CARRY, CARRY, CARRY]), target: 2,
        memory: {source: "e1620773914ad5a"}},
    {role: "upgrader", body: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE], target: 2,
        memory: {source: "e218077391460aa"}},
    {role: "builder", body: addMOVE([WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY]), target: 2,
        memory: {container: "5b3e8add5676c340a95d3ac1"}},
    {role: "miner", body: addMOVE([WORK, WORK, WORK, WORK, CARRY]), target: 0,
        memory: {source: "7ec06164d63658d", store: "5b408f605676c340a95e55b6"},
        condition: role.miner.spawnCondition,
    },
    {role: "miner", subtype: "_W5N9", body: addMOVE([WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY]), target: 0,
        memory: role.relocater.setMem({source: '9ef56164d4b4ba0', store: '5b408f605676c340a95e55b6'}, 'W5N9', 'miner'),
        condition: function(r) { return role.miner.spawnCondition(Game.rooms.W5N9) },
    },
    {role: "linkTransfer", dynSpawn: function(spawn) { 
        role.linkTransfer.spawn(spawn, Game.getObjectById(role.linkTransfer.pocketSrc), Game.getObjectById(role.linkTransfer.controllerLink));
    }, condition: function(room) { 
        return !_.some(Game.creeps, (c) => c.my && c.memory.reloNextRole == 'linkTransfer');
    }, target: 1},
];
var remoteUpgraderBody = Array(6).fill(WORK).concat(Array(6).fill(CARRY), Array(12).fill(MOVE));
var buildThreshold = 250; // TODO(baptr): calculate

function buildingSay(struct, text) {
    struct.room.visual.text(
        text,
        struct.pos.x + 1, 
        struct.pos.y, 
        {align: 'left', opacity: 0.8});
}

if(DUMP_COSTS) {
    _.forEach(colonyTargets, t => {
        var cost = util.creep.bodyCost(t.body);
        var id = "role " + t.role;
        if(t.subtype) { id += t.subtype }
        console.log(id + " costs " + cost);
    });
}

const main = {
runPlanners: function() {
    plan.room.run(Game.rooms.W5N8);
    plan.room.run(Game.rooms.W4N8);
    plan.room.run(Game.rooms.W5N3);
    plan.room.run(Game.rooms.W6N9);
    plan.room.run(Game.rooms.W8N7);
    plan.room.run(Game.rooms.W7N3);
    plan.room.run(Game.rooms.W7N9);
    plan.lab.test();
    plan.claim.test();
    plan.attack.test();
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
runBase: function() {
    var room = Game.rooms[BASE_NAME];
    var spawn = Game.spawns['Spawn1'];
    
    // TODO(baptr): Can this wait 20 ticks?
    if(room.find(FIND_HOSTILE_CREEPS).length) {
        console.log("We're under attack!!");
        buildingSay(spawn, "Oh snap");
        role.defender.spawn(spawn, {});
    }
    
    var kinds = _.groupBy(Game.creeps, creep => (creep.memory.reloNextRole || creep.memory.role)+creep.memory.subtype);
    _.forEach(colonyTargets, kind => {
        var targets = kinds[kind.role+kind.subtype] || [];
        if(targets.length >= kind.target) {
            return;
        }
        if(kind.condition && !kind.condition(room)) {
            return;
        }
        if(kind.dynSpawn) {
            kind.dynSpawn(spawn);
            return false;
        }
        var id = kind.role;
        if(kind.subtype) { id += kind.subtype }
        var newName = id + '_' + Game.time;
        var mem = kind.memory || {};
        if(!mem.role) { mem.role = kind.role; }
        mem.subtype = kind.subtype;
        var cost = util.creep.bodyCost(kind.body);
        if(cost > room.energyAvailable) {
            buildingSay(spawn, room.energyAvailable+'<'+cost);
            return false; // Might be able to spawn something less important, but we should save up.
        }
        var ret = spawn.spawnCreep(kind.body, newName, {memory: mem});
        buildingSay(spawn, targets.length+'/'+kind.target+' '+id);
        return false;
    })
    
    // TODO(baptr): Work this in to the normal hash.
    if(room.energyAvailable > util.creep.bodyCost(remoteUpgraderBody) && (kinds['upgrader_W5N9'] || []).length < 2) {
        spawn.spawnCreep(remoteUpgraderBody, 'remoteUpgrader_W5N9_'+Game.time, {memory: 
            {role: 'relocater', subtype: '_W5N9', reloRoom: 'W5N9', reloNextRole: 'upgrader',
                container: '5b4120c35676c340a95ea8f9'
            }})
    }
    
    if(!spawn.spawning) {
        var minerNeeded = room.memory.needMiner;
        if(minerNeeded) {
            //console.log("Need miner in " + room.name + " " + JSON.stringify(minerNeeded));
            role.dropMiner.spawn(spawn, minerNeeded);
            // XXX prevent multiple spawns.
        }
    }
},
runCreeps: function() {
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        // TODO(baptr): Some day I'm going to want to do something while some
        // role is still spawning, but until then...
        if(creep.spawning) continue;
        // TODO(baptr): Stop doing fallbacks here so there can be fewer special cases.
        switch(creep.memory.role) {
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
            if(role.iner.run(creep) === false) {
                role.repairer.run(creep);
            }
            break;
        default:
            var r = role[creep.memory.role];
            if(r) {
                r.run(creep);
            } else {
                console.log(name + " has no known role ("+creep.memory.role+")");
            }
        }
    }
},
runStructs: function() {
    for(var name in Game.structures) {
        var s = Game.structures[name];
        var m = struct[s.structureType];
        if(m) m.run(s);
    }
}
}
profiler.registerObject(main, 'main');

module.exports.loop = () => profiler.wrap(() => {
    main.runPlanners();
    
    if(Game.time % 20 == 0) {
        // Periodic cleanup
        main.cleanup();
        
        main.runBase();
    }
    
    main.runCreeps();
    main.runStructs();
    
    // Segmented stats are read every 15s.
    Memory.stats.cpu += Game.cpu.getUsed();
    if(Game.time % 50 == 0) {
        const stats = util.stats.run(Memory.stats.cpu);
        // Memory.stats = stats;
        RawMemory.segments[99] = JSON.stringify(stats);
    }
})