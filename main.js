const ROLES = ['harvester', 'remoteHarvester', 'upgrader', 'builder', 'repairer', 'defender', 'claimer', 'relocater', 'miner', 'linkTransfer', 'bob'];
const ROLE2S = ['bootstrapper', 'dropHarvester', 'miner', 'combatant', 'dismantler'];
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

var pathing = require('util.pathing');
var claimPlanner = require('plan.claim');
var labPlanner = require('plan.lab');
var planAttack = require('plan.attack');
var utilStats = require('util.stats');
var roomPlanner = require('plan.room');

var roleTower = require('role.tower');

var util = require('util');

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
        var cost = util.bodyCost(t.body);
        var id = "role " + t.role;
        if(t.subtype) { id += t.subtype }
        console.log(id + " costs " + cost);
    });
}

module.exports.loop = function () {
    roomPlanner.run(Game.rooms.W5N8);
    roomPlanner.run(Game.rooms.W4N8);
    roomPlanner.run(Game.rooms.W5N3);
    roomPlanner.run(Game.rooms.W6N9);
    roomPlanner.run(Game.rooms.W8N7);
    roomPlanner.run(Game.rooms.W7N3);
    roomPlanner.run(Game.rooms.W7N9);
    labPlanner.test();
    claimPlanner.test();
    planAttack.test();
    // TODO(baptr): Set up better lab control.
    // Game.getObjectById('5b4318745676c340a95fda83').runReaction(Game.getObjectById('5b4325e05676c340a95fe2d5'), Game.getObjectById('5b40a53a5676c340a95e62df'));
    var room = Game.rooms[BASE_NAME];
    // Periodic cleanup
    if(room.energyAvailable >= buildThreshold && Game.time % 20 == 0) {
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
        
        // Spawn checks...
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
            var cost = util.bodyCost(kind.body);
            if(cost > room.energyAvailable) {
                buildingSay(spawn, room.energyAvailable+'<'+cost);
                return false; // Might be able to spawn something less important, but we should save up.
            }
            var ret = spawn.spawnCreep(kind.body, newName, {memory: mem});
            buildingSay(spawn, targets.length+'/'+kind.target+' '+id);
            return false;
        })
        
        // TODO(baptr): Work this in to the normal hash.
        if(room.energyAvailable > util.bodyCost(remoteUpgraderBody) && (kinds['upgrader_W5N9'] || []).length < 2) {
            spawn.spawnCreep(remoteUpgraderBody, 'remoteUpgrader_W5N9_'+Game.time, {memory: 
                {role: 'relocater', subtype: '_W5N9', reloRoom: 'W5N9', reloNextRole: 'upgrader',
                    container: '5b4120c35676c340a95ea8f9'
                }})
        }
        
        if(!spawn.spawning) {
            var minerNeeded = room.memory.needMiner;
            if(minerNeeded) {
                //console.log("Need miner in " + room.name + " " + JSON.stringify(minerNeeded));
                // TOOD(baptr): need src?
                // XXX rename to dropMiner
                role.dropMiner.spawn(spawn, minerNeeded.dest);
                // XXX prevent multiple spawns.
            }
        }
    }
    
    if(Game.spawns['Spawn1'].spawning) { 
        var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
        buildingSay(Game.spawns['Spawn1'], '🛠️' + spawningCreep.memory.role);
    }
    
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
    
    for(var name in Game.structures) {
        var struct = Game.structures[name];
        if(struct.structureType != 'tower') { continue; }
        roleTower.run(struct);
    }
    
    // Segmented stats are read every 15s.
    if(Game.time % 50 == 0) {
        const stats = utilStats.run();
        // Memory.stats = stats;
        RawMemory.segments[99] = JSON.stringify(stats);
    }
}